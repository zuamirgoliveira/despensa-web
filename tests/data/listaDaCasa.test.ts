import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { definirQuantidade } from "@/data/despensa";
import { criarRepositorios } from "@/data/indexeddb";
import { alterarQuantidade, garantirListaDaCasa, removerItem } from "@/data/lista";
import type { Repositorios } from "@/data/repositorios";
import type { Produto } from "@/domain/types";

let repos: Repositorios;
let casaId: string;
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
  casaId = (await repos.casas.listar())[0].id;
});
afterEach(() => repos.fechar());

const produto = (nome: string, extra: Partial<Produto> = {}): Promise<Produto> =>
  repos.produtos.salvar({
    id: crypto.randomUUID(), casaId, nome, categoria: "mercearia", unidade: "un", meta: 4, metaManual: true, recorrente: true,
    frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
  });
const itens = async (listaId: string) => (await repos.itensLista.listarPorLista(listaId)).filter((i) => !i.removido);

describe("garantirListaDaCasa", () => {
  it("entra o recorrente zerado ou abaixo do padrão; o resto não", async () => {
    const [a, b, c, d] = [await produto("A"), await produto("B"), await produto("C"), await produto("D", { recorrente: false })];
    await definirQuantidade(repos, a, 0);
    await definirQuantidade(repos, b, 1);
    await definirQuantidade(repos, c, 4);
    await definirQuantidade(repos, d, 0);
    const { lista, naoRecorrentesZerados } = await garantirListaDaCasa(repos, "2026-11-06");
    const i = await itens(lista.id);
    expect(i.map((x) => [x.produtoId, x.quantidadeSugerida, x.motivo])).toEqual(expect.arrayContaining([[a.id, 4, "acabou"], [b.id, 3, "abaixo"]]));
    expect(i).toHaveLength(2);
    expect(naoRecorrentesZerados).toEqual([d.id]);
  });

  it("regerar reaproveita a lista e preserva edições; item reposto sai", async () => {
    const [a, b] = [await produto("A"), await produto("B")];
    await definirQuantidade(repos, a, 0);
    await definirQuantidade(repos, b, 0);
    const { lista } = await garantirListaDaCasa(repos, "2026-11-06");
    const [ia, ib] = [(await itens(lista.id)).find((x) => x.produtoId === a.id)!, (await itens(lista.id)).find((x) => x.produtoId === b.id)!];
    await alterarQuantidade(repos, ia, 9);
    await removerItem(repos, ib);
    await definirQuantidade(repos, b, 0); // continua zerado: o removido não volta

    const de = await garantirListaDaCasa(repos, "2026-11-07");
    expect(de.lista.id).toBe(lista.id);
    expect(await repos.listas.listar()).toHaveLength(1);
    const i = await itens(lista.id);
    expect(i).toHaveLength(1);
    expect(i[0]).toMatchObject({ produtoId: a.id, quantidadeSugerida: 9, quantidadeEditada: true });

    await definirQuantidade(repos, a, 4); // a editado manualmente permanece mesmo reposto
    expect((await itens((await garantirListaDaCasa(repos, "2026-11-07")).lista.id)).map((x) => x.produtoId)).toEqual([a.id]);
  });

  it("automático intocado que deixou de faltar sai da lista", async () => {
    const a = await produto("A");
    await definirQuantidade(repos, a, 0);
    const { lista } = await garantirListaDaCasa(repos, "2026-11-06");
    expect(await itens(lista.id)).toHaveLength(1);
    await definirQuantidade(repos, a, 4);
    await garantirListaDaCasa(repos, "2026-11-06");
    expect(await itens(lista.id)).toHaveLength(0);
  });

  it("lista fechada não é reaproveitada; a nova nasce com o que ainda falta", async () => {
    const a = await produto("A");
    await definirQuantidade(repos, a, 0);
    const { lista } = await garantirListaDaCasa(repos, "2026-11-06");
    await repos.listas.salvar({ ...lista, status: "fechada" });
    const nova = await garantirListaDaCasa(repos, "2026-11-13");
    expect(nova.lista.id).not.toBe(lista.id);
    expect(await itens(nova.lista.id)).toHaveLength(1);
  });

  it("item já pego não é tocado e a estimativa usa o último preço", async () => {
    const a = await produto("A");
    await definirQuantidade(repos, a, 0);
    const { lista } = await garantirListaDaCasa(repos, "2026-11-06");
    const [item] = await itens(lista.id);
    await repos.itensLista.salvar({ ...item, status: "pego", quantidadePega: 2 });
    await definirQuantidade(repos, a, 4);
    await garantirListaDaCasa(repos, "2026-11-06");
    expect((await itens(lista.id))[0]).toMatchObject({ status: "pego", quantidadePega: 2 });
  });
});

describe("uma única lista", () => {
  it("listas abertas do modelo antigo são fechadas e não interferem", async () => {
    const a = await produto("A");
    await definirQuantidade(repos, a, 0);
    const antiga = (extra: Partial<{ criadaEm: string; mercadoId: string }> = {}) =>
      repos.listas.salvar({ id: crypto.randomUUID(), casaId, tipoIda: "hortifruti_semanal", data: "2026-10-01", status: "rascunho", criadaEm: "2026-10-01T10:00:00Z", ...extra });
    const [l1, l2] = [await antiga(), await antiga({ criadaEm: "2026-10-02T10:00:00Z", mercadoId: crypto.randomUUID() })];
    await repos.itensLista.salvar({ id: crypto.randomUUID(), casaId, listaId: l1.id, produtoId: a.id, quantidadeSugerida: 9, status: "pendente", urgente: false, removido: false, quantidadeEditada: false, motivo: "cobertura" });

    const { lista } = await garantirListaDaCasa(repos, "2026-11-06");
    const abertas = (await repos.listas.listar()).filter((l) => l.status !== "fechada");
    expect(abertas.map((l) => l.id)).toEqual([lista.id]); // só uma segue aberta
    expect([l1.id, l2.id]).toContain(lista.id); // reaproveita a mais antiga
  });

  it("prefere a lista em compra e fecha as demais", async () => {
    const emCompra = await repos.listas.salvar({ id: crypto.randomUUID(), casaId, tipoIda: "mercado_semanal", data: "2026-11-05", status: "em_compra", criadaEm: "2026-11-05T10:00:00Z" });
    const rascunho = await repos.listas.salvar({ id: crypto.randomUUID(), casaId, tipoIda: "mercado_semanal", data: "2026-11-01", status: "rascunho", criadaEm: "2026-11-01T10:00:00Z" });
    const { lista } = await garantirListaDaCasa(repos, "2026-11-06");
    expect(lista.id).toBe(emCompra.id);
    expect((await repos.listas.obter(rascunho.id))?.status).toBe("fechada");
  });

  it("o que não foi comprado segue faltando na lista seguinte", async () => {
    const [a, b] = [await produto("A"), await produto("B")];
    await definirQuantidade(repos, a, 0);
    await definirQuantidade(repos, b, 0);
    const { lista } = await garantirListaDaCasa(repos, "2026-11-06");
    const [ia] = (await itens(lista.id)).filter((x) => x.produtoId === a.id);
    await repos.itensLista.salvar({ ...ia, status: "pego", quantidadePega: 4 });
    await definirQuantidade(repos, a, 4); // comprou só o A
    await repos.listas.salvar({ ...lista, status: "fechada" });
    const proxima = await garantirListaDaCasa(repos, "2026-11-13");
    expect((await itens(proxima.lista.id)).map((x) => x.produtoId)).toEqual([b.id]);
  });
});
