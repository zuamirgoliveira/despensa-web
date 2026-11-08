import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apagarTodosOsDados, contagemDoAparelho } from "@/data/apagarTudo";
import { criarRepositorios } from "@/data/indexeddb";
import { prepararConferencia, salvarNotaImportada } from "@/data/importarNota";
import type { Repositorios } from "@/data/repositorios";
import { parseNota } from "@/domain/nfce/parser";

const { nota } = parseNota(readFileSync(new URL("./../fixtures/notas/cia-santos-hortifruti.txt", import.meta.url), "utf8"));
let repos: Repositorios;
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

describe("apagarTodosOsDados", () => {
  it("apaga compras, produtos e mercados e recria a casa com os padrões", async () => {
    const nomes = Object.fromEntries((await prepararConferencia(repos, nota)).map((i) => [i.codigo, i.sugestaoNome]));
    await salvarNotaImportada(repos, { nota, chave: nota.chave as string, nomes });
    expect((await contagemDoAparelho(repos)).compras).toBe(1);

    await apagarTodosOsDados(repos);

    expect(await contagemDoAparelho(repos)).toEqual({ compras: 0, produtos: 0, mercados: 0, listas: 0 });
    expect(await repos.estoques.listar()).toHaveLength(0);
    expect(await repos.apelidos.listar()).toHaveLength(0);
    const casas = await repos.casas.listar();
    expect(casas).toHaveLength(1);
    expect(await repos.perfis.obterDaCasa(casas[0].id)).toBeDefined();
    expect((await repos.agendas.listar()).length).toBeGreaterThan(0); // agenda inicial do seed
  });

  it("em aparelho vazio também funciona", async () => {
    await apagarTodosOsDados(repos);
    expect(await repos.casas.listar()).toHaveLength(1);
  });
});
