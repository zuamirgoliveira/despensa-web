import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarRepositorios } from "@/data/indexeddb";
import { guardarNotaPendente, listarNotasPendentes, removerNotaPendente } from "@/data/notasPendentes";
import type { Repositorios } from "@/data/repositorios";

const CHAVE = "26261120300157005613651290000538591088539888";
const URL_QR = `https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=${CHAVE}|2|1|1|A889BEB8C3F7BD9C6FBCD31ABE7502218F4123B1`;
let repos: Repositorios;
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

describe("fila de QR para buscar depois", () => {
  it("guarda uma vez por nota e remove ao importar", async () => {
    expect(await guardarNotaPendente(repos, URL_QR, new Date("2026-11-08T12:00:00Z"))).toBe("guardada");
    expect(await guardarNotaPendente(repos, URL_QR, new Date("2026-11-08T13:00:00Z"))).toBe("guardada");
    const fila = await listarNotasPendentes(repos);
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ id: CHAVE, url: URL_QR });
    await removerNotaPendente(repos, CHAVE);
    expect(await listarNotasPendentes(repos)).toHaveLength(0);
  });

  it("recusa URL que não é da consulta de PE", async () => {
    expect(await guardarNotaPendente(repos, "https://evil.com/?p=1")).toBe("url_invalida");
    expect(await listarNotasPendentes(repos)).toHaveLength(0);
  });

  it("a fila acompanha o backup e é apagada com tudo", async () => {
    await guardarNotaPendente(repos, URL_QR);
    const { exportar } = await import("@/data/backup");
    expect((await exportar(repos)).colecoes.notasPendentes).toHaveLength(1);
    const { apagarTodosOsDados } = await import("@/data/apagarTudo");
    await apagarTodosOsDados(repos);
    expect(await listarNotasPendentes(repos)).toHaveLength(0);
  });
});
