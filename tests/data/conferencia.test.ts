import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { carregarFila, registrarConferencia, registrarNivel } from "@/data/conferencia";
import { criarRepositorios } from "@/data/indexeddb";
import type { Repositorios } from "@/data/repositorios";
import type { Produto } from "@/domain/types";

let repos: Repositorios;
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

const novo = async (nome: string, extra: Partial<Produto> = {}) => {
  const casa = (await repos.casas.listar())[0];
  return repos.produtos.salvar({
    id: crypto.randomUUID(), casaId: casa.id, nome, categoria: "mercearia", unidade: "un", meta: 30, metaManual: false,
    frequencia: "mensal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
  });
};

describe("registrarNivel", () => {
  it("cria o estoque e depois atualiza o mesmo registro", async () => {
    const p = await novo("Arroz");
    const a = await registrarNivel(repos, p, "metade", new Date("2026-11-08T10:00:00Z"));
    expect(a).toMatchObject({ produtoId: p.id, nivel: "metade", confirmadoEm: "2026-11-08T10:00:00.000Z" });
    const b = await registrarNivel(repos, p, "acabou", new Date("2026-11-09T10:00:00Z"), 0);
    expect(b.id).toBe(a.id);
    expect(b).toMatchObject({ nivel: "acabou", quantidadeExata: 0 });
    expect(await repos.estoques.listar()).toHaveLength(1);
  });

  it("nível sem quantidade exata apaga a quantidade anterior", async () => {
    const p = await novo("Arroz");
    await registrarNivel(repos, p, "metade", new Date(), 3);
    expect((await registrarNivel(repos, p, "cheio", new Date())).quantidadeExata).toBeUndefined();
  });
});

describe("carregarFila", () => {
  it("agrupa por local e traz só o que precisa conferir", async () => {
    const geladeira = await novo("Zebra", { localCasa: "Geladeira" });
    const armario = await novo("Arroz", { localCasa: "Armário" });
    const semLocal = await novo("Sal");
    await novo("Fora", { tipoIda: "hortifruti_semanal" });
    for (const p of [geladeira, armario, semLocal]) await registrarNivel(repos, p, "acabou", new Date("2026-11-08T10:00:00Z"));
    const fila = await carregarFila(repos, "mercado_semanal", "2026-11-08");
    expect(fila?.map((i) => [i.produto.nome, i.local])).toEqual([
      ["Arroz", "Armário"], ["Zebra", "Geladeira"], ["Sal", "Sem local"],
    ]);
  });

  it("tipo sem agenda devolve undefined", async () => {
    for (const a of await repos.agendas.listar()) await repos.agendas.apagar(a.id);
    expect(await carregarFila(repos, "mercado_semanal", "2026-11-08")).toBeUndefined();
  });
});

describe("registrarConferencia", () => {
  it("guarda tempo e quantidade", async () => {
    const r = await registrarConferencia(repos, { tipoIda: "mercado_semanal", iniciadaEm: "2026-11-08T10:00:00.000Z", duracaoSegundos: 95, produtosConferidos: 7 });
    expect(await repos.conferencias.obter(r.id)).toEqual(r);
  });
});
