import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { terminarSemNota } from "@/data/compra";
import {
  agruparLinhas, ajustarEstoque, apagarCompraDesfazendoEstoque, criarItemManual, definirQuantidade, deixarDeRepor, efeitoDeApagarCompra, ItemJaExisteError, reporSempre,
} from "@/data/despensa";
import { criarRepositorios } from "@/data/indexeddb";
import type { Repositorios } from "@/data/repositorios";
import type { Compra, ItemLista, Produto } from "@/domain/types";

let repos: Repositorios;
let casaId: string;
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
  casaId = (await repos.casas.listar())[0].id;
});
afterEach(() => repos.fechar());

const produto = (nome: string, extra: Partial<Produto> = {}): Promise<Produto> =>
  repos.produtos.salvar({
    id: crypto.randomUUID(), casaId, nome, categoria: "mercearia", unidade: "un", meta: 4, metaManual: true, recorrente: false,
    frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
  });
const compra = (itens: { produtoId?: string; quantidade: number }[], chave = "1".repeat(44)): Promise<Compra> =>
  repos.compras.salvar({
    casaId, chave, mercadoId: crypto.randomUUID(), emissao: "2026-11-04T10:00:00", valorTotalCentavos: 100, pagamento: "", importadoEm: "2026-11-04T12:00:00Z",
    itens: itens.map((i, n) => ({ codigo: String(n), descricao: "X", unidade: "UNID" as const, valorUnitarioCentavos: 100, valorTotalCentavos: 100, ...i })),
  });

describe("definirQuantidade / ajustarEstoque", () => {
  it("cria o registro, rotula o nível pelo padrão e aceita acima do padrão", async () => {
    const p = await produto("Arroz");
    expect(await definirQuantidade(repos, p, 2)).toMatchObject({ quantidade: 2, nivel: "metade" });
    expect(await definirQuantidade(repos, p, 9)).toMatchObject({ quantidade: 9, nivel: "cheio" });
    expect(await definirQuantidade(repos, p, 0)).toMatchObject({ quantidade: 0, nivel: "acabou" });
    expect(await repos.estoques.listar()).toHaveLength(1);
  });
  it("subtrair nunca fica abaixo de zero; produto inexistente é ignorado", async () => {
    const p = await produto("Feijao");
    await definirQuantidade(repos, p, 2);
    expect(await ajustarEstoque(repos, [{ produtoId: p.id, quantidade: 5 }, { produtoId: crypto.randomUUID(), quantidade: 1 }], -1)).toBe(1);
    expect((await repos.estoques.obterPorProduto(p.id))?.quantidade).toBe(0);
  });
  it("agruparLinhas soma o mesmo produto e ignora item sem produto", () => {
    expect(agruparLinhas([{ produtoId: "a", quantidade: 1 }, { produtoId: "a", quantidade: 2 }, { quantidade: 9 }])).toEqual([{ produtoId: "a", quantidade: 3 }]);
  });
});

describe("apagar compra desfaz a soma", () => {
  it("mostra o efeito e tira só o que a nota somou", async () => {
    const p = await produto("Leite");
    await definirQuantidade(repos, p, 7);
    const c = await compra([{ produtoId: p.id, quantidade: 3 }, { quantidade: 5 }]);
    expect(await efeitoDeApagarCompra(repos, c)).toEqual([{ produtoId: p.id, nome: "Leite", de: 7, para: 4 }]);
    await apagarCompraDesfazendoEstoque(repos, c);
    expect((await repos.estoques.obterPorProduto(p.id))?.quantidade).toBe(4);
    expect(await repos.compras.listar()).toEqual([]);
  });
  it("com menos em estoque do que a nota somou, zera", async () => {
    const p = await produto("Leite");
    await definirQuantidade(repos, p, 1);
    const c = await compra([{ produtoId: p.id, quantidade: 3 }]);
    await apagarCompraDesfazendoEstoque(repos, c);
    expect((await repos.estoques.obterPorProduto(p.id))?.quantidade).toBe(0);
  });
});

describe("terminar sem nota", () => {
  const lista = async () =>
    repos.listas.salvar({ id: crypto.randomUUID(), casaId, tipoIda: "mercado_semanal", data: "2026-11-14", status: "em_compra", criadaEm: "2026-11-08T10:00:00Z" });
  const item = (listaId: string, extra: Partial<ItemLista>) =>
    repos.itensLista.salvar({ id: crypto.randomUUID(), casaId, listaId, quantidadeSugerida: 2, status: "pendente", urgente: false, removido: false, quantidadeEditada: false, ...extra });

  it("soma o que foi pego, ignora o que não foi, fecha a lista com o total corrente", async () => {
    const [a, b, c] = [await produto("A"), await produto("B"), await produto("C")];
    await definirQuantidade(repos, a, 1);
    const l = await lista();
    await item(l.id, { produtoId: a.id, status: "pego", quantidadePega: 3, precoCentavos: 200 });
    await item(l.id, { produtoId: b.id, status: "pendente" });
    await item(l.id, { produtoId: c.id, status: "nao_encontrado" });
    await item(l.id, { nomeAvulso: "Extra", status: "extra", quantidadePega: 1, precoCentavos: 150 });
    expect(await terminarSemNota(repos, l.id)).toEqual({ produtos: 1 });
    expect((await repos.estoques.obterPorProduto(a.id))?.quantidade).toBe(4);
    expect(await repos.estoques.obterPorProduto(b.id)).toBeUndefined();
    expect(await repos.listas.obter(l.id)).toMatchObject({ status: "fechada", gastoCentavos: 750 });
  });
  it("lista já fechada não soma de novo", async () => {
    const a = await produto("A");
    const l = await lista();
    await item(l.id, { produtoId: a.id, status: "pego", quantidadePega: 3 });
    await terminarSemNota(repos, l.id);
    expect(await terminarSemNota(repos, l.id)).toBeUndefined();
    expect((await repos.estoques.obterPorProduto(a.id))?.quantidade).toBe(3);
  });
});

describe("repor sempre / deixar de repor", () => {
  it("promove com o padrão informado e rebaixa mantendo o padrão", async () => {
    const p = await produto("Sal", { meta: 1 });
    expect(await reporSempre(repos, p.id, 3)).toMatchObject({ recorrente: true, meta: 3, metaManual: true });
    expect(await deixarDeRepor(repos, p.id)).toMatchObject({ recorrente: false, meta: 3 });
    expect(await reporSempre(repos, crypto.randomUUID())).toBeUndefined();
  });
});

describe("criarItemManual", () => {
  it("nasce recorrente, com padrão e quantidade atual opcionais", async () => {
    const p = await criarItemManual(repos, { nome: " Café ", categoria: "mercearia", unidade: "pacote", padrao: 2, atual: 1 });
    expect(p).toMatchObject({ nome: "Café", recorrente: true, meta: 2, metaManual: true, ativo: true });
    expect(await repos.estoques.obterPorProduto(p.id)).toMatchObject({ quantidade: 1, nivel: "metade" });
  });
  it("sem padrão nem quantidade: sem registro de estoque", async () => {
    const p = await criarItemManual(repos, { nome: "Sal", categoria: "mercearia", unidade: "kg" });
    expect(p).toMatchObject({ meta: 0, metaManual: false });
    expect(await repos.estoques.obterPorProduto(p.id)).toBeUndefined();
  });
  it("recusa nome vazio e nome repetido (ignora caixa e acento)", async () => {
    await criarItemManual(repos, { nome: "Feijão", categoria: "mercearia", unidade: "kg" });
    await expect(criarItemManual(repos, { nome: "feijao", categoria: "mercearia", unidade: "kg" })).rejects.toBeInstanceOf(ItemJaExisteError);
    await expect(criarItemManual(repos, { nome: "  ", categoria: "mercearia", unidade: "kg" })).rejects.toThrow();
  });
});
