import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registrarNivel } from "@/data/conferencia";
import { criarRepositorios } from "@/data/indexeddb";
import { salvarNotaImportada } from "@/data/importarNota";
import { garantirLista } from "@/data/lista";
import { finalizarCompra, listasEmCompra, resumoDaLista } from "@/data/reconciliacao";
import { iniciarCompra } from "@/data/compra";
import type { Repositorios } from "@/data/repositorios";
import { parseNota } from "@/domain/nfce/parser";
import { readFileSync } from "node:fs";

const { nota } = parseNota(readFileSync(new URL("../fixtures/notas/cia-santos-hortifruti.txt", import.meta.url), "utf8"));
const CHAVE = nota.chave as string;
let repos: Repositorios;
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

const importar = async (n = nota, chave = CHAVE) => (await salvarNotaImportada(repos, { nota: n, chave, nomes: {}, agora: new Date("2026-11-05T12:00:00Z") })).compra;
const produtoPorNome = async (nome: string) => (await repos.produtos.listar()).find((p) => p.nome === nome)!;

describe("sem lista", () => {
  it("só atualiza o estoque: produtos comprados viram cheio", async () => {
    const compra = await importar();
    const r = await finalizarCompra(repos, compra, undefined, new Date("2026-11-05T12:00:00Z"));
    expect(r).toEqual({ compra });
    const estoques = await repos.estoques.listar();
    expect(estoques).toHaveLength(16);
    const desdeANota = new Date(`${compra.emissao}-03:00`).toISOString();
    expect(estoques.every((e) => e.nivel === "cheio" && e.confirmadoEm === desdeANota)).toBe(true);
  });

  it("o estoque vale desde a data da nota, não desde a importação (nota de ontem)", async () => {
    const compra = await importar({ ...nota, emissao: "2026-11-04T10:00:00" });
    await finalizarCompra(repos, compra, undefined, new Date("2026-11-05T12:00:00Z"));
    const estoques = await repos.estoques.listar();
    expect(estoques.every((e) => e.confirmadoEm === "2026-11-04T13:00:00.000Z")).toBe(true);
  });

  it("produto que estava como 'acabou' volta a cheio", async () => {
    const compra = await importar();
    const melao = await produtoPorNome("Melao Japones");
    await registrarNivel(repos, melao, "acabou", new Date("2026-11-01T10:00:00Z"));
    await finalizarCompra(repos, compra, undefined, new Date("2026-11-05T12:00:00Z"));
    expect((await repos.estoques.obterPorProduto(melao.id))?.nivel).toBe("cheio");
    expect(await repos.estoques.listar()).toHaveLength(16); // atualizou o mesmo registro
  });
});

describe("com lista", () => {
  // lista de hortifruti com 3 produtos que acabaram: Melão, Banana e Cenoura (+ um avulso)
  async function montarLista() {
    const compraInicial = await importar(); // cria o catálogo
    const lista0 = [await produtoPorNome("Melao Japones"), await produtoPorNome("Banana Prata"), await produtoPorNome("Cenoura")];
    for (const p of lista0) await registrarNivel(repos, p, "acabou", new Date("2026-11-08T10:00:00Z"));
    // limpa as demais para a lista ter só os 3: arquiva o resto
    for (const p of await repos.produtos.listar()) if (!lista0.some((x) => x.id === p.id)) await repos.produtos.salvar({ ...p, ativo: false });
    const lista = await garantirLista(repos, "hortifruti_semanal", "2026-11-08", new Date("2026-11-08T10:00:00Z"));
    await iniciarCompra(repos, lista.id);
    return { lista, compraInicial };
  }

  it("casa, grava preço e quantidade, liga a compra, fecha a lista e guarda o gasto", async () => {
    const { lista } = await montarLista();
    expect((await repos.itensLista.listarPorLista(lista.id)).map((i) => i.motivo)).toEqual(["acabou", "acabou", "acabou"]);
    // nova nota: comprou Melão e Banana (não a Cenoura) + Goiaba que não estava na lista
    const nova = {
      ...nota,
      emissao: "2026-11-11T10:00:00",
      itens: nota.itens.filter((i) => /MELAO|BANANA|GOIABA/.test(i.descricao)),
    };
    const compra = await importar(nova, "26261108868231000638650020000689041020778728");
    const r = await finalizarCompra(repos, compra, lista.id, new Date("2026-11-11T12:00:00Z"));

    expect(r.reconciliacao?.comprados).toHaveLength(2);
    expect(r.reconciliacao?.ficouDeFora.map((i) => i.produtoId)).toEqual([(await produtoPorNome("Cenoura")).id]);
    expect(r.reconciliacao?.foraDaLista).toHaveLength(1);
    expect(r.reconciliacao?.emergencias).toHaveLength(1); // hortifruti semanal é ida de reposição
    expect(r.lista).toMatchObject({ status: "fechada", gastoCentavos: compra.valorTotalCentavos });
    expect(r.resumo).toMatchObject({ comprados: 2, faltou: 1, foraDaLista: 1, emergencias: 1 });
    expect((await repos.compras.obter(compra.chave))?.listaId).toBe(lista.id);

    const itens = await repos.itensLista.listarPorLista(lista.id);
    const melao = itens.find((i) => i.produtoId === (r.reconciliacao?.comprados[0].item.produtoId))!;
    expect(melao).toMatchObject({ status: "pego" });
    expect(melao.precoCentavos).toBeGreaterThan(0);
    expect(itens.find((i) => i.produtoId === (r.reconciliacao?.ficouDeFora[0].produtoId))?.status).toBe("pendente");

    // estoque: comprados cheio; a cenoura segue como estava (acabou)
    expect((await repos.estoques.obterPorProduto((await produtoPorNome("Melao Japones")).id))?.nivel).toBe("cheio");
    expect((await repos.estoques.obterPorProduto((await produtoPorNome("Cenoura")).id))?.nivel).toBe("acabou");
  });

  it("o resumo recalculado da lista fechada bate com o do fechamento", async () => {
    const { lista } = await montarLista();
    const compra = await importar({ ...nota, emissao: "2026-11-11T10:00:00", itens: nota.itens.filter((i) => /MELAO/.test(i.descricao)) }, "26261108868231000638650020000689041020778728");
    const fechamento = await finalizarCompra(repos, compra, lista.id);
    const depois = await resumoDaLista(repos, lista.id);
    expect(depois?.resumo).toEqual(fechamento.resumo);
    expect(await resumoDaLista(repos, crypto.randomUUID())).toBeUndefined();
  });

  it("itens que ficaram de fora voltam na próxima lista do mesmo tipo", async () => {
    const { lista } = await montarLista();
    const compra = await importar({ ...nota, emissao: "2026-11-11T10:00:00", itens: nota.itens.filter((i) => /MELAO/.test(i.descricao)) }, "26261108868231000638650020000689041020778728");
    await finalizarCompra(repos, compra, lista.id);
    const cenoura = await produtoPorNome("Cenoura");
    await registrarNivel(repos, cenoura, "cheio", new Date("2026-11-12T10:00:00Z")); // a cobertura não a incluiria... a pendência sim
    const proxima = await garantirLista(repos, "hortifruti_semanal", "2026-11-12", new Date("2026-11-12T10:00:00Z"));
    expect(proxima.id).not.toBe(lista.id);
    const itens = await repos.itensLista.listarPorLista(proxima.id);
    expect(itens.map((i) => i.produtoId)).toContain(cenoura.id);
    // com a Cenoura como 'cheio' hoje, só a pendência da lista anterior a traz de volta (sem duplicar)
    expect(itens.filter((i) => i.produtoId === cenoura.id)).toHaveLength(1);
  });

  it("lista fechada por outra compra não é fechada de novo", async () => {
    const { lista } = await montarLista();
    const c1 = await importar({ ...nota, emissao: "2026-11-11T10:00:00", itens: nota.itens.filter((i) => /MELAO/.test(i.descricao)) }, "26261108868231000638650020000689041020778728");
    await finalizarCompra(repos, c1, lista.id);
    const c2 = await importar({ ...nota, emissao: "2026-11-12T10:00:00", itens: nota.itens.filter((i) => /BANANA/.test(i.descricao)) }, "26261108868231000638650020000689051020778724");
    const r = await finalizarCompra(repos, c2, lista.id);
    expect(r.lista).toBeUndefined(); // a lista já fechou com outra compra: só o estoque é atualizado
    expect((await repos.compras.obter(c2.chave))?.listaId).toBeUndefined();
  });

  it("substituir a mesma nota reprocessa a lista sem erro", async () => {
    const { lista } = await montarLista();
    const compra = await importar({ ...nota, emissao: "2026-11-11T10:00:00", itens: nota.itens.filter((i) => /MELAO/.test(i.descricao)) }, "26261108868231000638650020000689041020778728");
    const a = await finalizarCompra(repos, compra, lista.id);
    const b = await finalizarCompra(repos, a.compra, lista.id);
    expect(b.lista?.status).toBe("fechada");
    expect(await repos.listas.listar()).toHaveLength(1);
  });

  it("listasEmCompra devolve só as abertas para compra", async () => {
    const { lista } = await montarLista();
    expect((await listasEmCompra(repos)).map((l) => l.id)).toEqual([lista.id]);
    await repos.listas.salvar({ ...lista, status: "fechada" });
    expect(await listasEmCompra(repos)).toEqual([]);
  });
});
