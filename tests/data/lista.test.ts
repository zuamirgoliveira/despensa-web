import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registrarNivel } from "@/data/conferencia";
import { criarRepositorios } from "@/data/indexeddb";
import { adicionarAvulso, alterarQuantidade, garantirLista, removerItem, restaurarItem, SemAgendaError, tipoMaisProximo } from "@/data/lista";
import type { Repositorios } from "@/data/repositorios";
import type { Produto } from "@/domain/types";

let repos: Repositorios;
const HOJE = "2026-11-08"; // domingo: mercado 14/11, hortifruti 11/11, feira 30/11
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

const novo = async (nome: string, extra: Partial<Produto> = {}) => {
  const casa = (await repos.casas.listar())[0];
  return repos.produtos.salvar({
    id: crypto.randomUUID(), casaId: casa.id, nome, categoria: "mercearia", unidade: "un", meta: 7, metaManual: false,
    frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
  });
};
const acabou = (p: Produto) => registrarNivel(repos, p, "acabou", new Date("2026-11-08T10:00:00Z"));

describe("garantirLista", () => {
  it("cria a lista em rascunho com os itens sugeridos", async () => {
    const a = await novo("Arroz");
    await acabou(a);
    const l = await garantirLista(repos, "mercado_semanal", HOJE, new Date("2026-11-08T10:00:00Z"));
    expect(l).toMatchObject({ tipoIda: "mercado_semanal", data: "2026-11-14", status: "rascunho" });
    const itens = await repos.itensLista.listarPorLista(l.id);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ produtoId: a.id, status: "pendente", motivo: "acabou", removido: false, quantidadeEditada: false });
  });

  it("sem agenda do tipo lança erro claro", async () => {
    for (const a of await repos.agendas.listar()) await repos.agendas.apagar(a.id);
    await expect(garantirLista(repos, "mercado_semanal", HOJE)).rejects.toBeInstanceOf(SemAgendaError);
  });

  it("regerar não duplica a lista nem os itens", async () => {
    await acabou(await novo("Arroz"));
    const a = await garantirLista(repos, "mercado_semanal", HOJE);
    const b = await garantirLista(repos, "mercado_semanal", HOJE);
    expect(b.id).toBe(a.id);
    expect(await repos.listas.listar()).toHaveLength(1);
    expect(await repos.itensLista.listarPorLista(a.id)).toHaveLength(1);
  });

  it("regerar preserva edições: quantidade editada fica, removido continua removido, avulso fica", async () => {
    const [p1, p2, p3] = [await novo("A"), await novo("B"), await novo("C")];
    for (const p of [p1, p2, p3]) await acabou(p);
    const l = await garantirLista(repos, "mercado_semanal", HOJE);
    const itens = await repos.itensLista.listarPorLista(l.id);
    const de = (p: Produto) => itens.find((i) => i.produtoId === p.id)!;

    await alterarQuantidade(repos, de(p1), 9);
    await removerItem(repos, de(p2));
    await adicionarAvulso(repos, l, "  Pilha AA ", 2);

    await garantirLista(repos, "mercado_semanal", HOJE);
    const depois = await repos.itensLista.listarPorLista(l.id);
    expect(depois.find((i) => i.produtoId === p1.id)).toMatchObject({ quantidadeSugerida: 9, quantidadeEditada: true });
    expect(depois.find((i) => i.produtoId === p2.id)).toMatchObject({ removido: true });
    expect(depois.find((i) => i.produtoId === p3.id)).toMatchObject({ removido: false });
    expect(depois.find((i) => i.nomeAvulso === "Pilha AA")).toMatchObject({ quantidadeSugerida: 2, motivo: "manual" });
    expect(depois).toHaveLength(4); // nada duplicado
  });

  it("só acrescenta o que mudou: produto novo que acabou entra; quantidade não editada é atualizada", async () => {
    const a = await novo("A");
    await acabou(a);
    const l = await garantirLista(repos, "mercado_semanal", HOJE);
    const b = await novo("B");
    await acabou(b);
    await garantirLista(repos, "mercado_semanal", HOJE);
    expect((await repos.itensLista.listarPorLista(l.id)).map((i) => i.produtoId).sort()).toEqual([a.id, b.id].sort());
  });

  it("item automático intocado que deixou de ser sugerido sai", async () => {
    const a = await novo("A");
    await acabou(a);
    const l = await garantirLista(repos, "mercado_semanal", HOJE);
    await registrarNivel(repos, a, "cheio", new Date("2026-11-08T11:00:00Z")); // meta 7 semanal: ainda entra por cobertura
    await repos.produtos.salvar({ ...a, frequencia: "mensal", meta: 300 }); // agora dura muito: não entra mais
    await garantirLista(repos, "mercado_semanal", HOJE);
    expect(await repos.itensLista.listarPorLista(l.id)).toEqual([]);
  });

  it("lista fechada não é reaproveitada: a nova geração cria outra", async () => {
    await acabou(await novo("A"));
    const l = await garantirLista(repos, "mercado_semanal", HOJE);
    await repos.listas.salvar({ ...l, status: "fechada" });
    const nova = await garantirLista(repos, "mercado_semanal", HOJE);
    expect(nova.id).not.toBe(l.id);
  });

  it("guarda a estimativa de custo da lista", async () => {
    const a = await novo("A");
    await acabou(a);
    const casa = (await repos.casas.listar())[0];
    await repos.compras.salvar({
      casaId: casa.id, chave: "1".repeat(44), mercadoId: crypto.randomUUID(), emissao: "2026-10-01T10:00:00", valorTotalCentavos: 500, pagamento: "",
      importadoEm: "2026-11-05T10:00:00Z",
      itens: [{ codigo: "1", descricao: "A", produtoId: a.id, quantidade: 1, unidade: "UNID", valorUnitarioCentavos: 500, valorTotalCentavos: 500 }],
    });
    const l = await garantirLista(repos, "mercado_semanal", HOJE);
    const itens = await repos.itensLista.listarPorLista(l.id);
    expect(l.estimativaCentavos).toBe(Math.round(itens[0].quantidadeSugerida * 500));
  });
});

describe("itens", () => {
  it("alterarQuantidade arredonda e nunca fica negativa; restaurar desfaz a remoção", async () => {
    await acabou(await novo("A"));
    const l = await garantirLista(repos, "mercado_semanal", HOJE);
    const [i] = await repos.itensLista.listarPorLista(l.id);
    expect((await alterarQuantidade(repos, i, 1.23456)).quantidadeSugerida).toBe(1.235);
    expect((await alterarQuantidade(repos, i, -3)).quantidadeSugerida).toBe(0);
    const removido = await removerItem(repos, i).then(async () => (await repos.itensLista.listarPorLista(l.id))[0]);
    expect(removido.removido).toBe(true);
    expect((await restaurarItem(repos, removido)).removido).toBe(false);
  });

  it("avulso removido é apagado de verdade", async () => {
    const l = await garantirLista(repos, "mercado_semanal", HOJE);
    const a = await adicionarAvulso(repos, l, "Pilha", 1);
    await removerItem(repos, a);
    expect(await repos.itensLista.listarPorLista(l.id)).toEqual([]);
  });
});

describe("tipoMaisProximo", () => {
  it("escolhe a ida de data mais próxima", async () => {
    expect(await tipoMaisProximo(repos, "2026-11-08")).toBe("hortifruti_semanal"); // quarta 11/11
    expect(await tipoMaisProximo(repos, "2026-11-12")).toBe("mercado_semanal"); // sábado 14/11
    expect(await tipoMaisProximo(repos, "2026-11-04")).toBe("hortifruti_semanal"); // hoje é quarta
  });
  it("sem agendas: undefined", async () => {
    for (const a of await repos.agendas.listar()) await repos.agendas.apagar(a.id);
    expect(await tipoMaisProximo(repos, HOJE)).toBeUndefined();
  });
});

import { dividirLista } from "@/data/lista";

describe("dividirLista", () => {
  it("cria a segunda lista, move os itens indicados e não perde nenhum; regerar não duplica", async () => {
    const [a, b, c] = [await novo("A"), await novo("B"), await novo("C")];
    for (const p of [a, b, c]) await acabou(p);
    const lista = await garantirLista(repos, "mercado_semanal", HOJE);
    const mercadoA = crypto.randomUUID();
    const mercadoB = crypto.randomUUID();
    const { original, nova } = await dividirLista(repos, lista, mercadoA, mercadoB, [b.id, c.id]);
    expect(original).toMatchObject({ id: lista.id, mercadoId: mercadoA });
    expect(nova).toMatchObject({ tipoIda: "mercado_semanal", data: lista.data, mercadoId: mercadoB, status: "rascunho" });
    expect((await repos.itensLista.listarPorLista(lista.id)).map((i) => i.produtoId)).toEqual([a.id]);
    expect((await repos.itensLista.listarPorLista(nova.id)).map((i) => i.produtoId).sort()).toEqual([b.id, c.id].sort());
    expect((await repos.itensLista.listar())).toHaveLength(3); // nada se perdeu

    // regerar a original não traz de volta o que foi para a outra lista
    const regerada = await garantirLista(repos, "mercado_semanal", HOJE);
    expect(regerada.id).toBe(lista.id);
    expect((await repos.itensLista.listarPorLista(lista.id)).map((i) => i.produtoId)).toEqual([a.id]);
    expect(await repos.listas.listar()).toHaveLength(2);
  });
});
