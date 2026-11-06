import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registrarNivel } from "@/data/conferencia";
import { criarRepositorios } from "@/data/indexeddb";
import { adicionarAvulso, alterarQuantidade, garantirListaDaCasa, removerItem, restaurarItem } from "@/data/lista";
import type { Repositorios } from "@/data/repositorios";
import type { Produto } from "@/domain/types";

let repos: Repositorios;
const HOJE = "2026-11-08";
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

const novo = async (nome: string, extra: Partial<Produto> = {}) => {
  const casa = (await repos.casas.listar())[0];
  return repos.produtos.salvar({
    id: crypto.randomUUID(), casaId: casa.id, nome, categoria: "mercearia", unidade: "un", meta: 7, metaManual: false, recorrente: true,
    frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
  });
};
const acabou = (p: Produto) => registrarNivel(repos, p, "acabou", new Date("2026-11-08T10:00:00Z"));

describe("itens", () => {
  it("alterarQuantidade arredonda e nunca fica negativa; restaurar desfaz a remoção", async () => {
    await acabou(await novo("A"));
    const l = (await garantirListaDaCasa(repos, HOJE)).lista;
    const [i] = await repos.itensLista.listarPorLista(l.id);
    expect((await alterarQuantidade(repos, i, 1.23456)).quantidadeSugerida).toBe(1.235);
    expect((await alterarQuantidade(repos, i, -3)).quantidadeSugerida).toBe(0);
    const removido = await removerItem(repos, i).then(async () => (await repos.itensLista.listarPorLista(l.id))[0]);
    expect(removido.removido).toBe(true);
    expect((await restaurarItem(repos, removido)).removido).toBe(false);
  });

  it("avulso removido é apagado de verdade", async () => {
    const l = (await garantirListaDaCasa(repos, HOJE)).lista;
    const a = await adicionarAvulso(repos, l, "Pilha", 1);
    await removerItem(repos, a);
    expect(await repos.itensLista.listarPorLista(l.id)).toEqual([]);
  });
});
