import { describe, expect, it } from "vitest";
import { arredondarParaCima, estimarCusto, mesclarRegeracao, passoDaUnidade, type ItemListaSugerido } from "@/domain/lista";
import type { Compra, ItemLista } from "@/domain/types";

const casaId = crypto.randomUUID();
const id = () => crypto.randomUUID();
const compra = (data: string, itens: [string, number, number][]): Compra => ({
  casaId, chave: String(Math.random()).slice(2).padEnd(44, "0").slice(0, 44), mercadoId: id(), emissao: `${data}T10:00:00`,
  valorTotalCentavos: 0, pagamento: "", importadoEm: "2026-11-05T10:00:00Z",
  itens: itens.map(([produtoId, quantidade, preco], i) => ({
    codigo: String(i), descricao: "X", produtoId, quantidade, unidade: "KG" as const, valorUnitarioCentavos: preco, valorTotalCentavos: Math.round(preco * quantidade),
  })),
});

describe("arredondarParaCima", () => {
  it.each([
    [1.6000000000000003, 0.1, 1.6],
    [0.30000000000000004, 0.1, 0.3],
    [3.857, 1, 4],
    [3.857, 0.5, 4],
    [3.01, 0.5, 3.5],
    [0, 1, 0],
    [2, 1, 2],
  ])("%s com passo %s → %s", (v, passo, esperado) => expect(arredondarParaCima(v, passo)).toBe(esperado));
});

describe("mesclarRegeracao", () => {
  const sug = (produtoId: string, quantidade: number): ItemListaSugerido => ({ produtoId, quantidade, motivo: "cobertura", urgente: false });
  const item = (produtoId: string | undefined, extra: Partial<ItemLista> = {}): ItemLista => ({
    id: id(), casaId, listaId: id(), produtoId, nomeAvulso: produtoId ? undefined : "Pilha", quantidadeSugerida: 1, status: "pendente",
    urgente: false, removido: false, quantidadeEditada: false, motivo: produtoId ? "cobertura" : "manual", ...extra,
  });

  it("acrescenta o que é novo", () => {
    const a = id();
    expect(mesclarRegeracao([sug(a, 2)], [])).toEqual({ adicionar: [sug(a, 2)], atualizar: [], remover: [] });
  });

  it("atualiza a quantidade do que o usuário não tocou", () => {
    const a = id();
    const existente = item(a);
    const r = mesclarRegeracao([sug(a, 5)], [existente]);
    expect(r.atualizar).toEqual([{ id: existente.id, quantidadeSugerida: 5, motivo: "cobertura", urgente: false }]);
    expect(r.adicionar).toEqual([]);
  });

  it("quantidade editada permanece", () => {
    const a = id();
    expect(mesclarRegeracao([sug(a, 5)], [item(a, { quantidadeEditada: true })])).toEqual({ adicionar: [], atualizar: [], remover: [] });
  });

  it("removido continua removido (não reaparece)", () => {
    const a = id();
    expect(mesclarRegeracao([sug(a, 5)], [item(a, { removido: true })])).toEqual({ adicionar: [], atualizar: [], remover: [] });
  });

  it("itens já pegos não são alterados", () => {
    const a = id();
    expect(mesclarRegeracao([sug(a, 5)], [item(a, { status: "pego" })]).atualizar).toEqual([]);
  });

  it("automáticos intocados que deixaram de ser sugeridos saem; avulsos, extras e editados ficam", () => {
    const velho = item(id());
    const editado = item(id(), { quantidadeEditada: true });
    const avulso = item(undefined);
    const extra = item(id(), { status: "extra", motivo: "manual" });
    const r = mesclarRegeracao([], [velho, editado, avulso, extra]);
    expect(r.remover).toEqual([velho.id]);
  });
});

describe("estimarCusto", () => {
  const item = (extra: Partial<ItemLista>): ItemLista => ({
    id: id(), casaId, listaId: id(), quantidadeSugerida: 1, status: "pendente", urgente: false, removido: false, quantidadeEditada: false, ...extra,
  });
  const p1 = id();
  const compras = [compra("2026-10-01", [[p1, 1, 500]])];

  it("soma quantidade × último preço, ignora removidos e lista os sem preço", () => {
    const a = item({ produtoId: p1, quantidadeSugerida: 2.5 });
    const semHistorico = item({ produtoId: id() });
    const avulso = item({ nomeAvulso: "Pilha" });
    const removido = item({ produtoId: p1, removido: true, quantidadeSugerida: 9 });
    expect(estimarCusto([a, semHistorico, avulso, removido], compras)).toEqual({ totalCentavos: 1250, semPreco: [semHistorico.id, avulso.id] });
  });

  it("lista vazia", () => expect(estimarCusto([], compras)).toEqual({ totalCentavos: 0, semPreco: [] }));
});

describe("passoDaUnidade", () => {
  it.each([["kg", 0.1], ["un", 1], ["pacote", 1], ["l", 0.5]] as const)("%s → %s", (u, p) => expect(passoDaUnidade(u)).toBe(p));
});
