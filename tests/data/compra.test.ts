import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adicionarExtra, alternarPego, definirOrcamento, definirPreco, definirQuantidadePega, iniciarCompra, marcarEstado, removerDaCompra,
} from "@/data/compra";
import { criarRepositorios } from "@/data/indexeddb";
import { adicionarAvulso } from "@/data/lista";
import type { Repositorios } from "@/data/repositorios";
import type { ItemLista, Lista } from "@/domain/types";

let repos: Repositorios;
let lista: Lista;
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
  const casa = (await repos.casas.listar())[0];
  lista = await repos.listas.salvar({ id: crypto.randomUUID(), casaId: casa.id, tipoIda: "mercado_semanal", data: "2026-11-14", status: "rascunho", criadaEm: "2026-11-08T10:00:00Z" });
});
afterEach(() => repos.fechar());

const novoItem = (extra: Partial<ItemLista> = {}): Promise<ItemLista> =>
  repos.itensLista.salvar({
    id: crypto.randomUUID(), casaId: lista.casaId, listaId: lista.id, produtoId: crypto.randomUUID(), quantidadeSugerida: 2, status: "pendente",
    urgente: false, removido: false, quantidadeEditada: false, ...extra,
  });

describe("iniciarCompra", () => {
  it("rascunho vira em_compra; em_compra e fechada ficam como estão; inexistente devolve undefined", async () => {
    expect((await iniciarCompra(repos, lista.id))?.status).toBe("em_compra");
    expect((await iniciarCompra(repos, lista.id))?.status).toBe("em_compra");
    await repos.listas.salvar({ ...lista, status: "fechada" });
    expect((await iniciarCompra(repos, lista.id))?.status).toBe("fechada");
    expect(await iniciarCompra(repos, crypto.randomUUID())).toBeUndefined();
  });
});

describe("itens", () => {
  it("peguei grava a quantidade sugerida (ou a editada) e tocar de novo desfaz", async () => {
    const i = await novoItem();
    const pego = await alternarPego(repos, i);
    expect(pego).toMatchObject({ status: "pego", quantidadePega: 2 });
    expect((await alternarPego(repos, pego)).status).toBe("pendente");
    const editado = await definirQuantidadePega(repos, i, 3.5);
    expect(editado).toMatchObject({ status: "pendente", quantidadePega: 3.5 });
    expect((await alternarPego(repos, editado)).quantidadePega).toBe(3.5);
  });

  it("não encontrei e adiar alternam, e limpam a quantidade pega", async () => {
    const i = await alternarPego(repos, await novoItem());
    const nao = await marcarEstado(repos, i, "nao_encontrado");
    expect(nao).toMatchObject({ status: "nao_encontrado", quantidadePega: undefined });
    expect((await marcarEstado(repos, nao, "nao_encontrado")).status).toBe("pendente");
    expect((await marcarEstado(repos, nao, "adiado")).status).toBe("adiado");
  });

  it("quantidade pega nunca negativa e arredondada", async () => {
    const i = await novoItem();
    expect((await definirQuantidadePega(repos, i, -2)).quantidadePega).toBe(0);
    expect((await definirQuantidadePega(repos, i, 1.23456)).quantidadePega).toBe(1.235);
  });

  it("preço é opcional: define e limpa", async () => {
    const i = await novoItem();
    expect(i.precoCentavos).toBeUndefined();
    const com = await definirPreco(repos, i, 649);
    expect(com.precoCentavos).toBe(649);
    expect((await definirPreco(repos, com, undefined)).precoCentavos).toBeUndefined();
  });

  it("remover: produto do catálogo vira removido; avulso é apagado", async () => {
    const i = await novoItem();
    await removerDaCompra(repos, i);
    expect((await repos.itensLista.obter(i.id))?.removido).toBe(true);
    const a = await adicionarAvulso(repos, lista, "Pilha", 1);
    await removerDaCompra(repos, a);
    expect(await repos.itensLista.obter(a.id)).toBeUndefined();
  });
});

describe("extras e orçamento", () => {
  it("extra entra como pego, com a quantidade e o preço", async () => {
    const e = await adicionarExtra(repos, lista, " Chiclete ", 3, 150);
    expect(e).toMatchObject({ nomeAvulso: "Chiclete", status: "extra", quantidadeSugerida: 3, quantidadePega: 3, precoCentavos: 150, motivo: "manual" });
    expect((await repos.itensLista.listarPorLista(lista.id))[0].id).toBe(e.id);
  });
  it("orçamento define e limpa", async () => {
    const l = await definirOrcamento(repos, lista, 20000);
    expect(l.orcamentoCentavos).toBe(20000);
    expect((await definirOrcamento(repos, l, undefined)).orcamentoCentavos).toBeUndefined();
  });
});
