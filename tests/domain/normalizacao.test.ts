import { describe, expect, it } from "vitest";
import { chaveDeProduto, formatarTamanho, normalizarDescricao, produtosParecidos, sugerirMesclagens } from "@/domain/normalizacao";
import type { Compra, Produto } from "@/domain/types";

const produto = (id: string, nome: string, ativo = true): Produto =>
  ({ id, casaId: "c", nome, categoria: "mercearia", unidade: "un", meta: 1, metaManual: false, recorrente: true, frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo }) as Produto;

describe("normalizarDescricao: o mesmo item escrito de jeitos diferentes", () => {
  it.each([
    "Maionese LIZA 500g",
    "maionese liza 500 g",
    "maionese Liza 500g",
    "MAIONESE LIZA 500GR",
    "MAIONESE LIZA 500 GRS",
    "Maionese   Liza  500G.",
    "liza maionese 500g",
    "MAIONESE LIZA 0,5KG",
  ])("%s → Maionese Liza 500g", (entrada) => {
    const n = normalizarDescricao(entrada);
    expect(n.chave).toBe(chaveDeProduto("Maionese Liza 500g"));
    expect(n.tamanho).toEqual({ valor: 500, medida: "g" });
  });

  it("o nome exibido usa título e o tamanho canônico", () => {
    expect(normalizarDescricao("MAIONESE LIZA 500GR").nome).toBe("Maionese Liza 500g");
    expect(normalizarDescricao("maionese liza 500 g").nome).toBe("Maionese Liza 500g");
  });

  it.each([
    ["ARROZ TIO JOAO 1KG", "Arroz Tio Joao 1kg"],
    ["LEITE INTEGRAL 1L", "Leite Integral 1l"],
    ["LEITE INTEGRAL 1 LT", "Leite Integral 1l"],
    ["REFRIGERANTE 2 LITROS", "Refrigerante 2l"],
    ["SUCO 250ML", "Suco 250ml"],
    ["QUEIJO 1,5KG", "Queijo 1,5kg"],
    ["TOMATE KG", "Tomate"],
    ["BISCOITO RECHEADO PCT 180", "Biscoito Recheado"],
    ["MAIONESE LIZA UN", "Maionese Liza"],
    ["Pão de Queijo", "Pão de Queijo"],
    ["Café do Ponto 250G", "Café do Ponto 250g"],
  ])("%s → %s", (entrada, esperado) => expect(normalizarDescricao(entrada).nome).toBe(esperado));

  it("ignora acento, caixa e ordem na chave, mas mantém o tamanho como parte da identidade", () => {
    expect(chaveDeProduto("Pão de Queijo")).toBe(chaveDeProduto("pao queijo"));
    expect(chaveDeProduto("Maionese Liza 500g")).not.toBe(chaveDeProduto("Maionese Liza 400g"));
    expect(chaveDeProduto("Maionese Liza")).not.toBe(chaveDeProduto("Maionese Liza 500g"));
    expect(chaveDeProduto("Maionese Liza")).not.toBe(chaveDeProduto("Maionese Helmaz"));
  });

  it("é idempotente (normalizar um nome já normalizado não muda)", () => {
    for (const d of ["MAIONESE LIZA 500GR", "Leite Integral 1l", "Pão de Queijo", "Queijo 1,5kg"]) {
      const n = normalizarDescricao(d);
      expect(normalizarDescricao(n.nome)).toEqual(n);
    }
  });

  it("entradas vazias ou só com tamanho não quebram", () => {
    expect(normalizarDescricao("").nome).toBe("");
    expect(normalizarDescricao("500g").nome).toBe("500g");
    expect(normalizarDescricao("   ").chave).toBe("");
  });

  it("formatarTamanho", () => {
    expect(formatarTamanho({ valor: 500, medida: "g" })).toBe("500g");
    expect(formatarTamanho({ valor: 1000, medida: "g" })).toBe("1kg");
    expect(formatarTamanho({ valor: 1500, medida: "g" })).toBe("1,5kg");
    expect(formatarTamanho({ valor: 1050, medida: "g" })).toBe("1050g");
    expect(formatarTamanho({ valor: 2000, medida: "ml" })).toBe("2l");
    expect(formatarTamanho({ valor: 350, medida: "ml" })).toBe("350ml");
  });
});

describe("produtosParecidos (camada 3: só sugere)", () => {
  const catalogo = [
    produto("1", "Maionese Liza 500g"),
    produto("2", "Maionese Helmaz 500g"),
    produto("3", "Leite Integral 1l"),
    produto("4", "Maionese Liza Light 500g"),
    produto("5", "Maionese Liza 400g", false),
  ];

  it("mesmas palavras e tamanho ausente ou diferente: sugere com motivo 'tamanho'", () => {
    const r = produtosParecidos("Maionese Liza", catalogo);
    expect(r[0]).toMatchObject({ motivo: "tamanho", pontos: 1 });
    expect(r[0].produto.id).toBe("1");
  });

  it("produto de chave igual não é sugerido (já é o mesmo)", () => {
    expect(produtosParecidos("maionese liza 500 g", catalogo).map((p) => p.produto.id)).not.toContain("1");
  });

  it("2 de 3 palavras em comum sugere como 'parecido'; só a marca diferente não", () => {
    expect(produtosParecidos("Maionese Liza Light", catalogo).map((p) => [p.produto.id, p.motivo])).toContainEqual(["4", "tamanho"]);
    expect(produtosParecidos("Maionese Liza", catalogo).map((p) => p.produto.id)).toContain("4");
    expect(produtosParecidos("Maionese Liza", catalogo).map((p) => p.produto.id)).not.toContain("2");
    expect(produtosParecidos("Leite Desnatado 1l", catalogo)).toEqual([]);
  });

  it("ignora produtos arquivados e respeita o limite", () => {
    expect(produtosParecidos("Maionese Liza", catalogo).map((p) => p.produto.id)).not.toContain("5");
    const muitos = Array.from({ length: 6 }, (_, i) => produto(`m${i}`, `Maionese Liza Sabor${i}`));
    expect(produtosParecidos("Maionese Liza", muitos, 2)).toHaveLength(2);
  });
});

describe("sugerirMesclagens (duplicados do catálogo)", () => {
  const compra = (itens: { produtoId: string }[]): Compra => ({ itens } as unknown as Compra);

  it("junta escritas diferentes do mesmo produto e sugere como destino o mais usado", () => {
    const ps = [produto("a", "Maionese LIZA 500g"), produto("b", "maionese liza 500 g"), produto("c", "Leite Integral 1l")];
    const compras = [compra([{ produtoId: "b" }, { produtoId: "c" }]), compra([{ produtoId: "b" }])];
    const r = sugerirMesclagens(ps, compras);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ motivo: "igual" });
    expect(r[0].destino.id).toBe("b");
    expect(r[0].origem.id).toBe("a");
  });

  it("empate de uso: o nome mais curto é o destino", () => {
    const r = sugerirMesclagens([produto("a", "Maionese Liza 500g"), produto("b", "Maionese Liza")], []);
    expect(r[0]).toMatchObject({ motivo: "tamanho" });
    expect(r[0].destino.id).toBe("b");
  });

  it("não sugere o que é diferente, nem produtos arquivados; 'igual' vem antes de 'parecido'", () => {
    const ps = [
      produto("1", "Arroz Tio Joao 1kg"),
      produto("2", "Feijao Carioca 1kg"),
      produto("3", "Maionese Liza 500g"),
      produto("4", "maionese liza 500g"),
      produto("5", "Maionese Liza Light"),
      produto("6", "Arroz Tio Joao 1kg", false),
    ];
    const r = sugerirMesclagens(ps, []);
    expect(r.map((s) => s.motivo)).toEqual(["igual", "parecido", "parecido"]);
    expect(r.flatMap((s) => [s.origem.id, s.destino.id])).not.toContain("6");
    expect(r.flatMap((s) => [s.origem.id, s.destino.id])).not.toContain("2");
  });
});

import { faltaTamanho, lerTamanhoDigitado } from "@/domain/normalizacao";

describe("tamanho da embalagem na importação", () => {
  it.each([
    ["UNID", "Refri Coca Cola Sem", true],
    ["PCT", "Creme de Leite", true],
    ["UNID", "Coca Cola Zero 2l", false],
    ["KG", "Banana", false],
    ["L", "Leite", false],
  ])("faltaTamanho(%s, %s) = %s", (un, nome, esperado) => expect(faltaTamanho(un, nome)).toBe(esperado));

  it.each([
    ["2l", { valor: 2000, medida: "ml" }],
    ["350 ml", { valor: 350, medida: "ml" }],
    ["1,5kg", { valor: 1500, medida: "g" }],
    ["200g", { valor: 200, medida: "g" }],
    ["dois litros", undefined],
    ["", undefined],
    ["coca 2l", undefined],
  ])("lerTamanhoDigitado(%s)", (texto, esperado) => expect(lerTamanhoDigitado(texto)).toEqual(esperado));
});
