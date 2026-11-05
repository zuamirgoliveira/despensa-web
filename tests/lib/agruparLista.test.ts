import { describe, expect, it } from "vitest";
import { agruparPorCategoria, agruparPorMercado, temMercadosDiferentes, TITULO_AVULSOS, TITULO_SEM_MERCADO, type ItemVisao } from "@/lib/agruparLista";
import type { ItemLista, Mercado, Produto } from "@/domain/types";

const casaId = crypto.randomUUID();
const produto = (nome: string, extra: Partial<Produto> = {}): Produto => ({
  id: crypto.randomUUID(), casaId, nome, categoria: "mercearia", unidade: "un", meta: 1, metaManual: false, frequencia: "semanal",
  tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
});
const visao = (p?: Produto, avulso?: string): ItemVisao => ({
  produto: p,
  item: { id: crypto.randomUUID(), casaId, listaId: "x", produtoId: p?.id, nomeAvulso: avulso, quantidadeSugerida: 1, status: "pendente", urgente: false, removido: false, quantidadeEditada: false } as ItemLista,
});
const mercado = (nome: string): Mercado => ({
  id: crypto.randomUUID(), casaId, cnpj: "08868231000638", nome, endereco: "", tipo: "supermercado", transporte: "carro",
});

describe("agruparPorCategoria", () => {
  it("ordem das categorias do catálogo, nomes em ordem e avulsos por último; sem grupos vazios", () => {
    const g = agruparPorCategoria([
      visao(produto("Zebra", { categoria: "limpeza" })),
      visao(produto("Tomate", { categoria: "hortifruti" })),
      visao(undefined, "Pilha"),
      visao(produto("Alface", { categoria: "hortifruti" })),
    ]);
    expect(g.map((x) => x.titulo)).toEqual(["Hortifruti", "Limpeza", TITULO_AVULSOS]);
    expect(g[0].itens.map((v) => v.produto?.nome)).toEqual(["Alface", "Tomate"]);
  });
  it("lista vazia", () => expect(agruparPorCategoria([])).toEqual([]));
});

describe("agruparPorMercado", () => {
  const a = mercado("Atacadão");
  const b = mercado("Bom Preço");
  it("agrupa pelo mercado preferido; sem preferido e avulsos vão para o fim", () => {
    const g = agruparPorMercado(
      [visao(produto("X", { mercadoPreferidoId: b.id })), visao(produto("Y", { mercadoPreferidoId: a.id })), visao(produto("Z")), visao(undefined, "Pilha")],
      [a, b],
    );
    expect(g.map((x) => x.titulo)).toEqual(["Atacadão", "Bom Preço", TITULO_SEM_MERCADO]);
    expect(g[2].itens).toHaveLength(2);
  });
  it("usa o apelido do mercado quando existe", () => {
    expect(agruparPorMercado([visao(produto("X", { mercadoPreferidoId: a.id }))], [{ ...a, apelido: "Atacadão da esquina" }])[0].titulo).toBe("Atacadão da esquina");
  });
  it("mercado preferido inexistente cai em 'Sem mercado preferido'", () => {
    expect(agruparPorMercado([visao(produto("X", { mercadoPreferidoId: crypto.randomUUID() }))], [])[0].titulo).toBe(TITULO_SEM_MERCADO);
  });
});

describe("temMercadosDiferentes", () => {
  it("só com 2 ou mais mercados preferidos distintos", () => {
    const m1 = crypto.randomUUID();
    const m2 = crypto.randomUUID();
    expect(temMercadosDiferentes([])).toBe(false);
    expect(temMercadosDiferentes([visao(produto("A", { mercadoPreferidoId: m1 })), visao(produto("B", { mercadoPreferidoId: m1 }))])).toBe(false);
    expect(temMercadosDiferentes([visao(produto("A", { mercadoPreferidoId: m1 })), visao(produto("B", { mercadoPreferidoId: m2 }))])).toBe(true);
    expect(temMercadosDiferentes([visao(produto("A", { mercadoPreferidoId: m1 })), visao(produto("B"))])).toBe(false);
  });
});
