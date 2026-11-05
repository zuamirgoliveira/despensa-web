import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extrairEmbalagem, notaParseadaSchema, parseNota, suggestName } from "@/domain/nfce/parser";

const CHAVE = "26261108868231000638650020000689031020778720";
const dir = new URL("../../fixtures/notas/", import.meta.url);
const sample = readFileSync(new URL("cia-santos-hortifruti.txt", dir), "utf8");
const { nota, avisos, erros } = parseNota(sample);

describe("nota de exemplo (Cia Santos)", () => {
  it("sem erros nem avisos", () => {
    expect(erros).toEqual([]);
    expect(avisos).toEqual([]);
    expect(notaParseadaSchema.safeParse(nota).success).toBe(true);
  });

  it("cabeçalho", () => {
    expect(nota.loja.nome).toBe("CIA SANTOS DISTRIBUIDORA E IMPORTADORA DE HORTIFRUTI LTDA");
    expect(nota.loja.cnpj).toBe("08868231000638");
    expect(nota.loja.endereco).toMatch(/OLINDA, PE$/);
    expect(nota).toMatchObject({
      numero: 68903, serie: 2, emissao: "2026-11-04T10:33:31", chave: CHAVE, protocolo: "226261025408429",
      pagamento: "Cartão de Crédito", cpfNaNota: false,
    });
  });

  it("16 itens, total R$ 77,24 em centavos", () => {
    expect(nota.itens).toHaveLength(16);
    expect(nota.totalItens).toBe(16);
    expect(nota.valorPagarCentavos).toBe(7724);
    expect(nota.somaItensCentavos).toBe(7724);
  });

  it("itens lidos corretamente", () => {
    expect(nota.itens[0]).toEqual({
      descricao: "MELAO JAPONES KG", codigo: "0000000000052", quantidade: 1.26, unidade: "KG",
      valorUnitarioCentavos: 788, valorTotalCentavos: 993,
    });
    expect(nota.itens[3].unidade).toBe("UNID");
    expect(nota.itens[13]).toMatchObject({ descricao: "ALHO REDINHA PCT 180", codigo: "0000000035024" });
  });

  it("não guarda o texto bruto nem CPF no resultado", () => {
    expect(JSON.stringify(nota)).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(Object.keys(nota)).not.toContain("texto");
  });
});

describe("todas as fixtures em tests/fixtures/notas", () => {
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
    it(`${arquivo}: sem erros e total confere`, () => {
      const r = parseNota(readFileSync(new URL(arquivo, dir), "utf8"));
      expect(r.erros).toEqual([]);
      expect(r.nota.itens.length).toBeGreaterThan(0);
      expect(r.nota.cpfNaNota).toBe(false);
      expect(notaParseadaSchema.safeParse(r.nota).success).toBe(true);
    });
  }
});

describe("conferências", () => {
  it("total adulterado gera aviso (não erro)", () => {
    const r = parseNota(sample.replace("Valor a pagar R$:77,24", "Valor a pagar R$:80,00"));
    expect(r.erros).toEqual([]);
    expect(r.avisos.some((a) => /difere do valor a pagar/.test(a))).toBe(true);
  });

  it("diferença dentro da tolerância de R$ 0,05 não avisa; acima avisa", () => {
    expect(parseNota(sample.replace("Valor a pagar R$:77,24", "Valor a pagar R$:77,29")).avisos).toEqual([]);
    expect(parseNota(sample.replace("Valor a pagar R$:77,24", "Valor a pagar R$:77,30")).avisos).toHaveLength(1);
  });

  it("item faltando gera erro de contagem", () => {
    const r = parseNota(sample.replace(/GOIABA KG[\s\S]*?6,36\n/, ""));
    expect(r.erros.some((e) => /16 itens, mas li 15/.test(e))).toBe(true);
  });

  it("linha com conta errada gera aviso", () => {
    const r = parseNota(sample.replace("Qtde.: 1,26", "Qtde.: 2,26"));
    expect(r.avisos.some((a) => /MELAO JAPONES KG/.test(a))).toBe(true);
  });

  it("linha com diferença de até R$ 0,02 é tolerada", () => {
    // 1,26 × 7,88 = 9,9288 → 9,93; trocar o total por 9,95 (dif. 0,02) passa, 9,96 não
    expect(parseNota(sample.replace("Vl. Total\n9,93", "Vl. Total\n9,95")).avisos.some((a) => /MELAO/.test(a))).toBe(false);
    expect(parseNota(sample.replace("Vl. Total\n9,93", "Vl. Total\n9,96")).avisos.some((a) => /MELAO/.test(a))).toBe(true);
  });

  it("CNPJ divergente da chave gera erro", () => {
    const r = parseNota(sample.replace("CNPJ: 08.868.231/0006-38", "CNPJ: 11.222.333/0001-81"));
    expect(r.erros.some((e) => /CNPJ da chave/.test(e))).toBe(true);
  });

  it("número divergente da chave gera erro", () => {
    const r = parseNota(sample.replace("Número: 68903", "Número: 68904"));
    expect(r.erros.some((e) => /número da nota/.test(e))).toBe(true);
  });

  it("chave com DV errado gera erro; sem chave gera aviso", () => {
    const grupos = "2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720";
    expect(parseNota(sample.replace(grupos, grupos.replace("8720", "8721"))).erros.some((e) => /Chave de acesso no texto inválida/.test(e))).toBe(true);
    expect(parseNota(sample.replace(/Chave de acesso:/i, "Outra coisa:")).avisos.some((a) => /chave de acesso/i.test(a))).toBe(true);
  });

  it("texto sem relação com a nota gera erros, sem quebrar", () => {
    expect(parseNota("qualquer coisa").erros.length).toBeGreaterThanOrEqual(2);
    expect(parseNota("").erros.length).toBeGreaterThanOrEqual(2);
    expect(parseNota(null).erros.length).toBeGreaterThanOrEqual(2);
  });
});

describe("tolerância de formato", () => {
  const base = (item: string, extra = "") =>
    `LOJA X\nCNPJ: 08.868.231/0006-38\n${item}\n\nQtd. total de itens:1\nValor a pagar R$:2.500,00\nData de Emissão: 01/01/2026 10:00:00${extra}`;

  it("milhar com ponto", () => {
    const r = parseNota(base("FILE MIGNON KG(Código: 12)\nQtde.: 2,5  UN: KG  Vl. Unit.: 1.000,00\n\nVl. Total\n2.500,00"));
    expect(r.nota.itens[0]).toMatchObject({ valorUnitarioCentavos: 100000, valorTotalCentavos: 250000 });
    expect(r.nota.valorPagarCentavos).toBe(250000);
    expect(r.erros).toEqual([]);
  });

  it("CRLF, NBSP e espaços extras", () => {
    const txt = sample.replace(/\n/g, "\r\n").replace(/Qtde\.:/g, "Qtde.:\u00a0").replace(/UN: /g, "UN:   ");
    const r = parseNota(txt);
    expect(r.erros).toEqual([]);
    expect(r.nota.itens).toHaveLength(16);
    expect(r.nota.valorPagarCentavos).toBe(7724);
  });

  it.each([
    ["UN", "UNID"],
    ["UNID", "UNID"],
    ["KG", "KG"],
    ["L", "L"],
    ["PCT", "PCT"],
  ])("unidade %s vira %s", (un, esperado) => {
    const r = parseNota(base(`ITEM(Código: 1)\nQtde.: 1  UN: ${un}  Vl. Unit.: 2.500,00\n\nVl. Total\n2.500,00`));
    expect(r.nota.itens[0].unidade).toBe(esperado);
  });

  it("unidade desconhecida gera aviso e vira UNID", () => {
    const r = parseNota(base("ITEM(Código: 1)\nQtde.: 1  UN: CX  Vl. Unit.: 2.500,00\n\nVl. Total\n2.500,00"));
    expect(r.nota.itens[0].unidade).toBe("UNID");
    expect(r.avisos.some((a) => /unidade "CX"/.test(a))).toBe(true);
  });
});

describe("CPF", () => {
  it("sinaliza e nunca devolve o CPF", () => {
    const r = parseNota(sample.replace("Consumidor não identificado", "CPF: 123.456.789-09"));
    expect(r.nota.cpfNaNota).toBe(true);
    expect(JSON.stringify(r)).not.toContain("123.456.789-09");
  });

  it("CPF solto no formato 000.000.000-00 também é detectado", () => {
    expect(parseNota(sample + "\nConsumidor 123.456.789-09").nota.cpfNaNota).toBe(true);
  });
});

describe("suggestName", () => {
  it.each([
    ["MELAO JAPONES KG", "Melao Japones"],
    ["COENTRO UN", "Coentro"],
    ["ALHO REDINHA PCT 180", "Alho Redinha"],
    ["  ARROZ   TIPO 1  ", "Arroz Tipo 1"],
  ])("%s → %s", (entrada, esperado) => expect(suggestName(entrada)).toBe(esperado));
});

describe("extrairEmbalagem", () => {
  it.each([
    ["ALHO REDINHA PCT 180", { tipo: "pct", tamanho: 180 }],
    ["CAFE PCT 500G", { tipo: "pct", tamanho: 500, medida: "g" }],
    ["LEITE UHT 1L", { tipo: "un", tamanho: 1000, medida: "ml" }],
    ["AGUA 1,5 L", { tipo: "un", tamanho: 1500, medida: "ml" }],
    ["ACUCAR 2KG", { tipo: "un", tamanho: 2000, medida: "g" }],
    ["IOGURTE 170 ML", { tipo: "un", tamanho: 170, medida: "ml" }],
    ["OVOS CX 12", { tipo: "cx", tamanho: 12 }],
    ["TOMATE KG", null],
  ])("%s", (desc, esperado) => expect(extrairEmbalagem(desc)).toEqual(esperado));
});
