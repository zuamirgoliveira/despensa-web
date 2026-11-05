import { describe, expect, it } from "vitest";
import { mesAnterior, metricasDoMes, painelTemDados, tendencia, type EntradaPainel } from "@/domain/painel";
import type { Compra, ItemLista, Lista, RegistroConferencia } from "@/domain/types";

const casaId = crypto.randomUUID();
const id = () => crypto.randomUUID();
const [M1, M2] = [id(), id()];
const [P1, P2, P3] = [id(), id(), id()];
let n = 0;
const compra = (data: string, mercadoId: string, produtos: string[], extra: Partial<Compra> = {}): Compra => ({
  casaId, chave: String(++n).padStart(44, "0"), mercadoId, emissao: `${data}T10:00:00`, valorTotalCentavos: 1000, pagamento: "", importadoEm: "2026-11-05T10:00:00Z",
  itens: produtos.map((produtoId, i) => ({ codigo: String(i), descricao: "X", produtoId, quantidade: 1, unidade: "UNID" as const, valorUnitarioCentavos: 100, valorTotalCentavos: 100 })), ...extra,
});
const lista = (tipoIda: Lista["tipoIda"]): Lista => ({ id: id(), casaId, tipoIda, data: "2026-11-07", status: "fechada", criadaEm: "2026-11-05T10:00:00Z" });
const itemLista = (listaId: string, produtoId: string): ItemLista => ({
  id: id(), casaId, listaId, produtoId, quantidadeSugerida: 1, status: "pego", urgente: false, removido: false, quantidadeEditada: false,
});
const conf = (iniciadaEm: string, duracaoSegundos: number, rupturas: number): RegistroConferencia => ({
  id: id(), casaId, tipoIda: "mercado_semanal", iniciadaEm, duracaoSegundos, produtosConferidos: 5, rupturas,
});
const mercados = [{ id: M1, tempoMinIda: 12 }, { id: M2, tempoMinIda: undefined }];

describe("metricasDoMes", () => {
  const l1 = lista("mercado_semanal");
  const l2 = lista("hortifruti_semanal");
  const e: EntradaPainel = {
    compras: [
      compra("2026-11-04", M1, [P1, P2, P3], { listaId: l1.id, itensCasados: 2, custoIdaCentavos: 756 }), // P3 fora da lista → emergência
      compra("2026-11-11", M1, [P1], { listaId: l2.id, itensCasados: 1, custoIdaCentavos: 756 }),
      compra("2026-11-20", M2, [P1, P2], { itensCasados: 0 }), // sem lista
      compra("2026-10-20", M1, [P1], { itensCasados: 1 }),
    ],
    listas: [l1, l2],
    itensLista: [itemLista(l1.id, P1), itemLista(l1.id, P2), itemLista(l2.id, P1)],
    mercados,
    conferencias: [conf("2026-11-03T12:00:00-03:00", 100, 2), conf("2026-11-10T12:00:00-03:00", 200, 1), conf("2026-10-10T12:00:00-03:00", 50, 9)],
  };
  const m = metricasDoMes(e, "2026-11");

  it("idas e por tipo (com 'sem lista')", () => {
    expect(m.idas).toBe(3);
    expect(m.idasPorTipo).toEqual({ mercado_semanal: 1, hortifruti_semanal: 1, sem_lista: 1 });
  });
  it("compras de emergência: itens fora da lista em ida de reposição", () => expect(m.emergencias).toBe(1));
  it("rupturas = 'acabou' na conferência + emergências", () => expect(m.rupturas).toBe(2 + 1 + 1));
  it("tempo médio de conferência só do mês", () => expect(m.tempoMedioConferenciaSegundos).toBe(150));
  it("% de itens casados: (2+1+0) de (3+1+2) itens", () => expect(m.itensCasadosPct).toBeCloseTo(50, 6));
  it("deslocamento em dinheiro e minutos (tempo de ida × 2; só dos mercados com tempo)", () => {
    expect(m.deslocamentoCentavos).toBe(1512);
    expect(m.minutosEmIdas).toBe(48);
  });

  it("mês sem dados: contagens zero e médias indefinidas (não zeros enganosos)", () => {
    const v = metricasDoMes(e, "2026-12");
    expect(v).toMatchObject({ idas: 0, emergencias: 0, rupturas: 0, deslocamentoCentavos: 0, minutosEmIdas: 0 });
    expect(v.tempoMedioConferenciaSegundos).toBeUndefined();
    expect(v.itensCasadosPct).toBeUndefined();
  });

  it("emergência não conta na feira mensal", () => {
    const f = lista("feira_mensal");
    const r = metricasDoMes({ ...e, compras: [compra("2026-11-04", M1, [P1, P3], { listaId: f.id })], listas: [f], itensLista: [itemLista(f.id, P1)], conferencias: [] }, "2026-11");
    expect(r.emergencias).toBe(0);
  });

  it("compras antigas sem 'itensCasados' ficam fora da porcentagem", () => {
    const r = metricasDoMes({ ...e, compras: [compra("2026-11-04", M1, [P1])], listas: [], itensLista: [], conferencias: [] }, "2026-11");
    expect(r.itensCasadosPct).toBeUndefined();
  });

  it("conferência perto da meia-noite cai no mês de Recife", () => {
    const r = metricasDoMes({ ...e, compras: [], conferencias: [conf("2026-12-01T01:00:00Z", 90, 0)] }, "2026-11"); // 30/11 22h em Recife
    expect(r.tempoMedioConferenciaSegundos).toBe(90);
  });
});

describe("tendencia", () => {
  it.each([
    [3, 5, "menor", "melhorou"],
    [5, 3, "menor", "piorou"],
    [4, 4, "menor", "igual"],
    [80, 60, "maior", "melhorou"],
    [60, 80, "maior", "piorou"],
    [undefined, 5, "menor", "sem_dados"],
    [5, undefined, "maior", "sem_dados"],
    [0, 2, "menor", "melhorou"],
  ] as const)("%s contra %s (melhor quando %s) → %s", (a, b, quando, esperado) => expect(tendencia(a, b, quando)).toBe(esperado));
});

describe("mesAnterior / painelTemDados", () => {
  it("mês anterior", () => {
    expect(mesAnterior("2026-11")).toBe("2026-10");
    expect(mesAnterior("2026-01")).toBe("2025-12");
  });
  it("sem compras não há painel", () => {
    expect(painelTemDados({ compras: [] })).toBe(false);
    expect(painelTemDados({ compras: [compra("2026-11-04", M1, [P1])] })).toBe(true);
  });
});
