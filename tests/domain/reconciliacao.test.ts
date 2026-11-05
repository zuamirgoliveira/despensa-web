import { describe, expect, it } from "vitest";
import { ehIdaDeReposicao, reconciliar, resumirCompra } from "@/domain/reconciliacao";
import type { ItemCompra, ItemLista } from "@/domain/types";

const casaId = crypto.randomUUID();
const P = { a: crypto.randomUUID(), b: crypto.randomUUID(), c: crypto.randomUUID(), d: crypto.randomUUID() };

const lista = (produtoId: string | undefined, extra: Partial<ItemLista> = {}): ItemLista => ({
  id: crypto.randomUUID(), casaId, listaId: "l", produtoId, nomeAvulso: produtoId ? undefined : "Pilha", quantidadeSugerida: 1, status: "pendente",
  urgente: false, removido: false, quantidadeEditada: false, ...extra,
});
const nota = (produtoId: string | undefined, descricao = "ITEM", extra: Partial<ItemCompra> = {}): ItemCompra => ({
  codigo: crypto.randomUUID().slice(0, 8), descricao, produtoId, quantidade: 1, unidade: "UNID", valorUnitarioCentavos: 100, valorTotalCentavos: 100, ...extra,
});

describe("reconciliar: três grupos", () => {
  it("comprado, ficou de fora e fora da lista", () => {
    const a = lista(P.a);
    const b = lista(P.b);
    const r = reconciliar({ tipoIda: "mercado_semanal" }, [a, b], [nota(P.a), nota(P.c)]);
    expect(r.comprados.map((x) => x.item.id)).toEqual([a.id]);
    expect(r.ficouDeFora.map((x) => x.id)).toEqual([b.id]);
    expect(r.foraDaLista.map((x) => x.produtoId)).toEqual([P.c]);
  });

  it("fora da lista em ida de reposição é compra de emergência; na feira mensal não é", () => {
    const itens = [lista(P.a)];
    const compra = [nota(P.a), nota(P.c)];
    expect(reconciliar({ tipoIda: "mercado_semanal" }, itens, compra).emergencias).toHaveLength(1);
    expect(reconciliar({ tipoIda: "hortifruti_semanal" }, itens, compra).emergencias).toHaveLength(1);
    expect(reconciliar({ tipoIda: "feira_mensal" }, itens, compra).emergencias).toEqual([]);
    expect(ehIdaDeReposicao("feira_mensal")).toBe(false);
  });

  it("dois itens da nota do mesmo produto contam como um comprado", () => {
    const r = reconciliar({ tipoIda: "mercado_semanal" }, [lista(P.a)], [nota(P.a), nota(P.a)]);
    expect(r.comprados).toHaveLength(1);
    expect(r.comprados[0].itensNota).toHaveLength(2);
    expect(r.foraDaLista).toEqual([]);
  });

  it("itens removidos da lista são ignorados: se vieram na nota, são fora da lista", () => {
    const removido = lista(P.a, { removido: true });
    const r = reconciliar({ tipoIda: "mercado_semanal" }, [removido], [nota(P.a)]);
    expect(r.comprados).toEqual([]);
    expect(r.ficouDeFora).toEqual([]);
    expect(r.foraDaLista).toHaveLength(1);
  });

  it("não encontrei e adiado que não vieram na nota ficam de fora; se vieram, foram comprados", () => {
    const naoAchou = lista(P.a, { status: "nao_encontrado" });
    const adiado = lista(P.b, { status: "adiado" });
    const r = reconciliar({ tipoIda: "mercado_semanal" }, [naoAchou, adiado], [nota(P.b)]);
    expect(r.ficouDeFora.map((x) => x.id)).toEqual([naoAchou.id]);
    expect(r.comprados.map((x) => x.item.id)).toEqual([adiado.id]);
  });

  it("avulsos e extras casam pelo nome na descrição da nota", () => {
    const avulso = lista(undefined, { nomeAvulso: "Pilha" });
    const extra = lista(undefined, { nomeAvulso: "Chiclete", status: "extra" });
    const sumiu = lista(undefined, { nomeAvulso: "Vela" });
    const r = reconciliar({ tipoIda: "mercado_semanal" }, [avulso, extra, sumiu], [nota(undefined, "PILHA ALCALINA AA"), nota(undefined, "CHICLETE MENTA")]);
    expect(r.comprados.map((x) => x.item.id).sort()).toEqual([avulso.id, extra.id].sort());
    expect(r.ficouDeFora.map((x) => x.id)).toEqual([sumiu.id]);
    expect(r.foraDaLista).toEqual([]);
  });

  it("nome avulso vazio não casa com tudo", () => {
    const r = reconciliar({ tipoIda: "mercado_semanal" }, [lista(undefined, { nomeAvulso: " " })], [nota(undefined, "QUALQUER")]);
    expect(r.comprados).toEqual([]);
    expect(r.foraDaLista).toHaveLength(1);
  });

  it("lista vazia e nota vazia", () => {
    expect(reconciliar({ tipoIda: "mercado_semanal" }, [], [])).toEqual({ comprados: [], ficouDeFora: [], foraDaLista: [], emergencias: [] });
    expect(reconciliar({ tipoIda: "mercado_semanal" }, [lista(P.a)], []).ficouDeFora).toHaveLength(1);
    expect(reconciliar({ tipoIda: "mercado_semanal" }, [], [nota(P.a)]).emergencias).toHaveLength(1);
  });
});

describe("resumirCompra", () => {
  const r = reconciliar({ tipoIda: "mercado_semanal" }, [lista(P.a), lista(P.b)], [nota(P.a), nota(P.c)]);

  it("contagens, gasto contra estimativa e custo real com a ida", () => {
    const s = resumirCompra(r, { valorTotalCentavos: 7724, custoIdaCentavos: 540 }, 8000);
    expect(s).toEqual({
      comprados: 1, faltou: 1, foraDaLista: 1, emergencias: 1, gastoCentavos: 7724, estimativaCentavos: 8000, diferencaCentavos: -276,
      custoIdaCentavos: 540, custoRealCentavos: 8264,
    });
  });

  it("sem estimativa e sem custo da ida: campos ausentes", () => {
    const s = resumirCompra(r, { valorTotalCentavos: 1000 });
    expect(s.diferencaCentavos).toBeUndefined();
    expect(s.custoRealCentavos).toBeUndefined();
    expect(s.gastoCentavos).toBe(1000);
  });

  it("custo da ida zero (bike a custo zero) também gera custo real", () => {
    expect(resumirCompra(r, { valorTotalCentavos: 1000, custoIdaCentavos: 0 }).custoRealCentavos).toBe(1000);
  });
});
