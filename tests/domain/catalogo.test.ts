import { describe, expect, it } from "vitest";
import { chaveDeNome, metaAutomatica, novoProduto, sugestaoDeTipoDeIda } from "@/domain/catalogo";
import type { Compra } from "@/domain/types";
import { sugerirTipoMercado } from "@/domain/mercados";
import { produtoSchema } from "@/schemas";

describe("novoProduto", () => {
  const base = { id: crypto.randomUUID(), casaId: crypto.randomUUID(), mercadoTipo: "hortifruti" as const };

  it("hortifruti: unidade kg, meta = quantidade, vida útil 7, ida de hortifruti", () => {
    const p = novoProduto({ ...base, nome: " Melao Japones ", item: { unidade: "KG", quantidade: 1.26 } });
    expect(p).toMatchObject({
      nome: "Melao Japones", unidade: "kg", categoria: "hortifruti", meta: 1.26, metaManual: false,
      tipoIda: "hortifruti_semanal", vidaUtilDias: 7, frequencia: "semanal", ativo: true,
    });
    expect(produtoSchema.safeParse(p).success).toBe(true);
  });

  it.each([
    ["UNID", "un"],
    ["PCT", "pacote"],
    ["L", "l"],
  ] as const)("unidade %s vira %s", (nota, produto) => {
    expect(novoProduto({ ...base, nome: "X", item: { unidade: nota, quantidade: 1 } }).unidade).toBe(produto);
  });

  it("supermercado: categoria pelo nome, ida de mercado semanal e vida útil da categoria", () => {
    const arroz = novoProduto({ ...base, mercadoTipo: "supermercado", nome: "Arroz Tipo 1", item: { unidade: "PCT", quantidade: 1 } });
    expect(arroz).toMatchObject({ categoria: "mercearia", tipoIda: "mercado_semanal", vidaUtilDias: 180 });
    const leite = novoProduto({ ...base, mercadoTipo: "supermercado", nome: "Leite Integral", item: { unidade: "UNID", quantidade: 6 } });
    expect(leite).toMatchObject({ categoria: "laticinios", vidaUtilDias: 10 });
    const coisa = novoProduto({ ...base, mercadoTipo: "supermercado", nome: "Pilha AA", item: { unidade: "UNID", quantidade: 1 } });
    expect(coisa).toMatchObject({ categoria: "outros", vidaUtilDias: 90 });
  });
});

describe("chaveDeNome", () => {
  it("ignora caixa, acento e espaços", () => {
    expect(chaveDeNome("  Pimentão   Verde ")).toBe(chaveDeNome("pimentao verde"));
  });
});

describe("sugerirTipoMercado", () => {
  it.each([
    ["CIA SANTOS DISTRIBUIDORA E IMPORTADORA DE HORTIFRUTI LTDA", "hortifruti"],
    ["Sacolão do Zé", "hortifruti"],
    ["ASSAI ATACADISTA S/A", "atacarejo"],
    ["Atacarejo Bom Preço", "atacarejo"],
    ["SUPERMERCADO EXTRA", "supermercado"],
    ["", "supermercado"],
  ])("%s → %s", (nome, tipo) => expect(sugerirTipoMercado(nome)).toBe(tipo));
});

let n = 0;
const compra = (data: string, itens: [string, number][]): Compra => ({
  casaId: crypto.randomUUID(), chave: String(++n).padStart(44, "0"), mercadoId: crypto.randomUUID(), emissao: `${data}T10:00:00`,
  valorTotalCentavos: 0, pagamento: "", importadoEm: "2026-11-05T10:00:00Z",
  itens: itens.map(([produtoId, quantidade], i) => ({
    codigo: String(i), descricao: "X", produtoId, quantidade, unidade: "KG" as const, valorUnitarioCentavos: 100, valorTotalCentavos: 100,
  })),
});

describe("metaAutomatica", () => {
  const p = crypto.randomUUID();
  it("sem compra: undefined", () => expect(metaAutomatica(p, [])).toBeUndefined());
  it("uma compra: a própria quantidade", () => expect(metaAutomatica(p, [compra("2026-10-01", [[p, 1.26]])])).toBe(1.26));
  it("média da quantidade por compra", () => {
    expect(metaAutomatica(p, [compra("2026-10-01", [[p, 1]]), compra("2026-10-08", [[p, 2]]), compra("2026-10-15", [[p, 3.5]])])).toBe(2.167);
  });
  it("itens do mesmo produto na mesma nota somam antes da média", () => {
    expect(metaAutomatica(p, [compra("2026-10-01", [[p, 1], [p, 1]]), compra("2026-10-08", [[p, 4]])])).toBe(3);
  });
});

describe("sugestaoDeTipoDeIda", () => {
  const id = crypto.randomUUID();
  const produto = (extra = {}) => ({ id, tipoIda: "mercado_semanal" as const, vidaUtilDias: 180, ativo: true, ...extra });
  // semanas (segunda a domingo): 05/10, 12/10, 19/10, 26/10 de 2026 são segundas-feiras
  const semanais = (...datas: string[]) => datas.map((d) => compra(d, [[id, 1]]));

  it("3 semanas seguidas de produto durável sugere feira mensal", () => {
    const s = sugestaoDeTipoDeIda(produto(), semanais("2026-10-07", "2026-10-14", "2026-10-21"));
    expect(s).toMatchObject({ tipoIda: "feira_mensal" });
    expect(s?.motivo).toContain("3 semanas seguidas");
  });
  it("mais de 3 semanas também", () => {
    expect(sugestaoDeTipoDeIda(produto(), semanais("2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"))?.motivo).toContain("4 semanas");
  });
  it("2 semanas seguidas não sugere", () => expect(sugestaoDeTipoDeIda(produto(), semanais("2026-10-14", "2026-10-21"))).toBeUndefined());
  it("semana pulada quebra a sequência", () => {
    expect(sugestaoDeTipoDeIda(produto(), semanais("2026-10-07", "2026-10-14", "2026-10-28"))).toBeUndefined();
  });
  it("duas compras na mesma semana contam uma vez", () => {
    expect(sugestaoDeTipoDeIda(produto(), semanais("2026-10-07", "2026-10-08", "2026-10-14"))).toBeUndefined();
  });
  it("domingo e a segunda seguinte são semanas diferentes (e seguidas)", () => {
    expect(sugestaoDeTipoDeIda(produto(), semanais("2026-10-11", "2026-10-12", "2026-10-19"))).toBeDefined(); // dom 11/10 · seg 12/10 · seg 19/10
  });
  it("perecível, arquivado ou já de feira mensal não sugere", () => {
    const c = semanais("2026-10-07", "2026-10-14", "2026-10-21");
    expect(sugestaoDeTipoDeIda(produto({ vidaUtilDias: 7 }), c)).toBeUndefined();
    expect(sugestaoDeTipoDeIda(produto({ ativo: false }), c)).toBeUndefined();
    expect(sugestaoDeTipoDeIda(produto({ tipoIda: "feira_mensal" }), c)).toBeUndefined();
  });
  it("sem compras não sugere", () => expect(sugestaoDeTipoDeIda(produto(), [])).toBeUndefined());
});
