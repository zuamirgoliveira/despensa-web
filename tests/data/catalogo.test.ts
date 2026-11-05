import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { liberarMetaAutomatica, MesclagemInvalidaError, mesclarProdutos, salvarProdutoEditado } from "@/data/catalogo";
import { criarRepositorios } from "@/data/indexeddb";
import { salvarNotaImportada } from "@/data/importarNota";
import type { Repositorios } from "@/data/repositorios";
import { historicoPorProduto } from "@/domain/precos";
import { parseNota } from "@/domain/nfce/parser";

const texto = readFileSync(new URL("../fixtures/notas/cia-santos-hortifruti.txt", import.meta.url), "utf8");
const { nota } = parseNota(texto);
const CHAVE = nota.chave as string;
const OUTRA_CHAVE = "26261108868231000638650020000689041020778728";
let repos: Repositorios;

beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

const importar = (n = nota, chave = CHAVE) => salvarNotaImportada(repos, { nota: n, chave, nomes: {} });
const comQuantidade = (codigo: string, quantidade: number) => ({
  ...nota,
  emissao: "2026-11-11T10:00:00",
  itens: nota.itens.map((i) => (i.codigo === codigo ? { ...i, quantidade } : i)),
});
const MELAO = "0000000000052";

describe("catálogo nasce das notas", () => {
  it("a nota de exemplo cria 16 produtos hortifruti, com unidade e meta = quantidade comprada", async () => {
    await importar();
    const produtos = await repos.produtos.listar();
    expect(produtos).toHaveLength(16);
    expect(produtos.every((p) => p.categoria === "hortifruti" && p.tipoIda === "hortifruti_semanal" && p.vidaUtilDias === 7)).toBe(true);
    const melao = produtos.find((p) => p.nome === "Melao Japones")!;
    expect(melao).toMatchObject({ unidade: "kg", meta: 1.26, metaManual: false, frequencia: "semanal", ativo: true });
    expect(produtos.find((p) => p.nome === "Coentro")).toMatchObject({ unidade: "un", meta: 1 });
    for (const i of nota.itens) {
      const p = produtos.find((x) => x.nome.toLowerCase().startsWith(i.descricao.split(" ")[0].toLowerCase()));
      expect(p?.meta).toBe(i.quantidade);
    }
  });

  it("segunda compra atualiza a meta pela média", async () => {
    await importar();
    await importar(comQuantidade(MELAO, 2.74), OUTRA_CHAVE);
    const melao = (await repos.produtos.listar()).find((p) => p.nome === "Melao Japones")!;
    expect(melao.meta).toBe(2); // (1,26 + 2,74) / 2
    expect(melao.metaManual).toBe(false);
    expect(await repos.produtos.listar()).toHaveLength(16); // nenhum produto duplicado
  });

  it("substituir a mesma nota não distorce a média", async () => {
    await importar();
    await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: {}, substituir: true });
    expect((await repos.produtos.listar()).find((p) => p.nome === "Melao Japones")?.meta).toBe(1.26);
  });

  it("editar a meta à mão trava a atualização automática; liberar volta à média", async () => {
    await importar();
    const melao = (await repos.produtos.listar()).find((p) => p.nome === "Melao Japones")!;
    const editado = await salvarProdutoEditado(repos, melao, { ...melao, meta: 5 });
    expect(editado).toMatchObject({ meta: 5, metaManual: true });
    await importar(comQuantidade(MELAO, 2.74), OUTRA_CHAVE);
    expect((await repos.produtos.obter(melao.id))?.meta).toBe(5); // não mudou
    await liberarMetaAutomatica(repos, melao.id);
    expect(await repos.produtos.obter(melao.id)).toMatchObject({ meta: 2, metaManual: false });
  });

  it("editar outro campo (sem mexer na meta) não trava a meta", async () => {
    await importar();
    const p = (await repos.produtos.listar())[0];
    const editado = await salvarProdutoEditado(repos, p, { ...p, nome: "Outro nome" });
    expect(editado.metaManual).toBe(false);
  });
});

describe("mesclar produtos", () => {
  it("move apelidos, itens de compra e histórico para o destino e apaga a origem", async () => {
    await importar();
    const produtos = await repos.produtos.listar();
    const origem = produtos.find((p) => p.nome === "Melao Japones")!;
    const destino = produtos.find((p) => p.nome === "Banana Prata")!;
    await repos.estoques.salvar({ id: crypto.randomUUID(), casaId: origem.casaId, produtoId: origem.id, nivel: "metade", confirmadoEm: "2026-11-05T10:00:00Z" });

    const r = await mesclarProdutos(repos, origem.id, destino.id);

    expect(await repos.produtos.obter(origem.id)).toBeUndefined();
    expect(r.id).toBe(destino.id);
    expect(await repos.produtos.listar()).toHaveLength(15);
    expect((await repos.apelidos.obter(["08868231000638", MELAO]))?.produtoId).toBe(destino.id);
    const [compra] = await repos.compras.listar();
    expect(compra.itens.filter((i) => i.produtoId === destino.id)).toHaveLength(2); // banana + melão
    expect(compra.itens.some((i) => i.produtoId === origem.id)).toBe(false);
    // o histórico de preços do destino agora inclui o do melão
    const h = historicoPorProduto([compra]).find((x) => x.produtoId === destino.id && x.unidade === "KG")!;
    expect(h.pontos).toHaveLength(2);
    // estoque da origem foi para o destino (que não tinha)
    expect(await repos.estoques.obterPorProduto(destino.id)).toMatchObject({ nivel: "metade" });
    expect(await repos.estoques.obterPorProduto(origem.id)).toBeUndefined();
    // meta automática do destino recalculada: (1,1 + 1,26) → mesma compra, soma 2,36 em uma nota
    expect(r.meta).toBe(2.36);
  });

  it("quando o destino já tem estoque, mantém o do destino", async () => {
    await importar();
    const [origem, destino] = await repos.produtos.listar();
    const base = { casaId: origem.casaId, confirmadoEm: "2026-11-05T10:00:00Z" };
    await repos.estoques.salvar({ id: crypto.randomUUID(), produtoId: origem.id, nivel: "acabou", ...base });
    await repos.estoques.salvar({ id: crypto.randomUUID(), produtoId: destino.id, nivel: "cheio", ...base });
    await mesclarProdutos(repos, origem.id, destino.id);
    expect(await repos.estoques.listar()).toHaveLength(1);
    expect((await repos.estoques.obterPorProduto(destino.id))?.nivel).toBe("cheio");
  });

  it("move itens de lista", async () => {
    await importar();
    const [origem, destino] = await repos.produtos.listar();
    const lista = await repos.listas.salvar({ id: crypto.randomUUID(), casaId: origem.casaId, tipoIda: "mercado_semanal", data: "2026-11-14", status: "rascunho", criadaEm: "2026-11-05T10:00:00Z" });
    await repos.itensLista.salvar({ id: crypto.randomUUID(), casaId: origem.casaId, listaId: lista.id, produtoId: origem.id, quantidadeSugerida: 1, status: "pendente", urgente: false, removido: false, quantidadeEditada: false });
    await mesclarProdutos(repos, origem.id, destino.id);
    expect((await repos.itensLista.listarPorLista(lista.id))[0].produtoId).toBe(destino.id);
  });

  it("rejeita o mesmo produto e produto inexistente", async () => {
    await importar();
    const [p] = await repos.produtos.listar();
    await expect(mesclarProdutos(repos, p.id, p.id)).rejects.toBeInstanceOf(MesclagemInvalidaError);
    await expect(mesclarProdutos(repos, p.id, crypto.randomUUID())).rejects.toThrow(/não encontrado/);
  });
});
