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
    id: crypto.randomUUID(), casaId: casa.id, nome, categoria: "mercearia", unidade: "un", meta: 30, metaManual: false, recorrente: true,
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
  it("agrupa por local e traz só o que precisa revisar", async () => {
    const geladeira = await novo("Zebra", { localCasa: "Geladeira" });
    const armario = await novo("Arroz", { localCasa: "Armário" });
    const semLocal = await novo("Sal");
    const feito = await novo("Feito");
    await registrarNivel(repos, feito, "acabou", new Date("2026-11-08T10:00:00Z")); // acabou, confirmado hoje: fora
    expect([geladeira, armario, semLocal].length).toBe(3);
    const fila = await carregarFila(repos, "2026-11-08");
    expect(fila.map((i) => [i.produto.nome, i.local, i.motivo])).toEqual([
      ["Arroz", "Armário", "sem_registro"], ["Zebra", "Geladeira", "sem_registro"], ["Sal", "Sem local", "sem_registro"],
    ]);
  });
});

describe("registrarConferencia", () => {
  it("guarda tempo e quantidade", async () => {
    const r = await registrarConferencia(repos, { iniciadaEm: "2026-11-08T10:00:00.000Z", duracaoSegundos: 95, produtosConferidos: 7 });
    expect(await repos.conferencias.obter(r.id)).toEqual(r);
  });
});

describe("rupturas", () => {
  it("marcar 'acabou' um produto que não estava acabado é ruptura; repetir não é", async () => {
    const p = await novo("Arroz");
    expect((await registrarNivel(repos, p, "metade", new Date())).ruptura).toBe(false);
    expect((await registrarNivel(repos, p, "acabou", new Date())).ruptura).toBe(true);
    expect((await registrarNivel(repos, p, "acabou", new Date())).ruptura).toBe(false);
    const sem = await novo("Sal");
    expect((await registrarNivel(repos, sem, "acabou", new Date())).ruptura).toBe(true); // sem registro anterior
  });
  it("a sessão guarda as rupturas (padrão 0)", async () => {
    const a = await registrarConferencia(repos, { iniciadaEm: "2026-11-08T10:00:00.000Z", duracaoSegundos: 10, produtosConferidos: 2 });
    const b = await registrarConferencia(repos, { iniciadaEm: "2026-11-08T10:00:00.000Z", duracaoSegundos: 10, produtosConferidos: 2, rupturas: 3 });
    expect([a.rupturas, b.rupturas]).toEqual([0, 3]);
  });
});
