import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackupInvalidoError, exportar, importar, lerBackup, VERSAO_BACKUP } from "@/data/backup";
import { DadoInvalidoError } from "@/data/indexeddb/colecao";
import { abrirBanco, criarRepositorios, criarRepositoriosComBanco } from "@/data/indexeddb";
import { MIGRACOES } from "@/data/indexeddb/migrations";
import { aoMudar, type NomeColecao } from "@/data/eventos";
import type { Repositorios } from "@/data/repositorios";
import type { Casa, Compra, Produto } from "@/domain/types";

const id = () => crypto.randomUUID();
const CHAVE = "26261108868231000638650020000689031020778720";
let fabrica: IDBFactory;
let repos: Repositorios;
let casa: Casa;

beforeEach(async () => {
  fabrica = new IDBFactory();
  repos = await criarRepositorios({ indexedDB: fabrica });
  casa = (await repos.casas.listar())[0];
});
afterEach(() => repos.fechar());

const produto = (nome: string, extra: Partial<Produto> = {}): Produto => ({
  id: id(), casaId: casa.id, nome, categoria: "hortifruti", unidade: "kg", meta: 1, metaManual: false, recorrente: true,
  frequencia: "semanal", tipoIda: "hortifruti_semanal", vidaUtilDias: 7, contavel: false, ativo: true, ...extra,
});

const compra = (mercadoId: string, emissao: string, chave = CHAVE): Compra => ({
  casaId: casa.id, chave, mercadoId, emissao, valorTotalCentavos: 993, pagamento: "Cartão", importadoEm: "2026-11-05T10:00:00Z",
  itens: [{ codigo: "52", descricao: "MELAO KG", quantidade: 1.26, unidade: "KG", valorUnitarioCentavos: 788, valorTotalCentavos: 993 }],
});

describe("primeira abertura", () => {
  it("cria uma casa padrão e o perfil com valores padrão, uma única vez", async () => {
    expect(await repos.casas.listar()).toHaveLength(1);
    const perfil = await repos.perfis.obterDaCasa(casa.id);
    expect(perfil).toMatchObject({ folgaDias: 2, limiarAlertaPrecoPct: 20, bikeCentavosPorKm: 5 });
    await repos.iniciar();
    expect(await repos.casas.listar()).toHaveLength(1);
    expect(await repos.perfis.listar()).toHaveLength(1);
  });

  it("reabrir o mesmo banco mantém a mesma casa", async () => {
    repos.fechar();
    repos = await criarRepositorios({ indexedDB: fabrica });
    expect((await repos.casas.listar())[0].id).toBe(casa.id);
  });
});

describe("CRUD", () => {
  it("produtos: salvar, obter, listar, atualizar, apagar", async () => {
    const p = produto("Tomate");
    const salvo = await repos.produtos.salvar(p);
    expect(salvo).toEqual(p);
    expect(await repos.produtos.obter(p.id)).toEqual(p);
    await repos.produtos.salvar({ ...p, meta: 2 });
    expect((await repos.produtos.listar()).map((x) => x.meta)).toEqual([2]);
    await repos.produtos.apagar(p.id);
    expect(await repos.produtos.obter(p.id)).toBeUndefined();
    expect(await repos.produtos.listar()).toEqual([]);
  });

  it("mercados: obterPorCnpj", async () => {
    const m = await repos.mercados.salvar({
      id: id(), casaId: casa.id, cnpj: "08868231000638", nome: "Cia Santos", endereco: "", tipo: "hortifruti", transporte: "carro",
    });
    expect(await repos.mercados.obterPorCnpj("08868231000638")).toEqual(m);
    expect(await repos.mercados.obterPorCnpj("00000000000000")).toBeUndefined();
  });

  it("apelidos: chave composta cnpj + código", async () => {
    const produtoId = id();
    const a = { casaId: casa.id, cnpj: "08868231000638", codigo: "52", produtoId };
    await repos.apelidos.salvar(a);
    await repos.apelidos.salvar({ ...a, codigo: "53" });
    await repos.apelidos.salvar({ ...a, cnpj: "11222333000181", produtoId: id() });
    expect(await repos.apelidos.obter(["08868231000638", "52"])).toEqual(a);
    expect(await repos.apelidos.listarPorCnpj("08868231000638")).toHaveLength(2);
    expect(await repos.apelidos.listarPorProduto(produtoId)).toHaveLength(2);
    await repos.apelidos.apagar(["08868231000638", "52"]);
    expect(await repos.apelidos.obter(["08868231000638", "52"])).toBeUndefined();
    expect(await repos.apelidos.listar()).toHaveLength(2);
  });

  it("estoques: um por produto", async () => {
    const produtoId = id();
    const e = await repos.estoques.salvar({ id: id(), casaId: casa.id, produtoId, quantidade: 0.5, nivel: "metade", confirmadoEm: "2026-11-05T10:00:00Z" });
    expect(await repos.estoques.obterPorProduto(produtoId)).toEqual(e);
    await expect(
      repos.estoques.salvar({ id: id(), casaId: casa.id, produtoId, quantidade: 1, nivel: "cheio", confirmadoEm: "2026-11-05T10:00:00Z" }),
    ).rejects.toBeDefined();
  });

  it("compras: chave natural, mais recente primeiro, por mercado", async () => {
    const m1 = id();
    const m2 = id();
    const k = (n: number) => CHAVE.slice(0, 43 - String(n).length) + String(n) + "0";
    await repos.compras.salvar(compra(m1, "2026-10-01T10:00:00", k(1)));
    await repos.compras.salvar(compra(m2, "2026-11-04T10:00:00", k(2)));
    await repos.compras.salvar(compra(m1, "2026-10-20T10:00:00", k(3)));
    expect((await repos.compras.listarPorEmissao()).map((c) => c.emissao)).toEqual([
      "2026-11-04T10:00:00", "2026-10-20T10:00:00", "2026-10-01T10:00:00",
    ]);
    expect(await repos.compras.listarPorMercado(m1)).toHaveLength(2);
    expect(await repos.compras.obter(k(2))).toMatchObject({ mercadoId: m2 });
    await repos.compras.apagar(k(2));
    expect(await repos.compras.listar()).toHaveLength(2);
  });

  it("listas e itens: listarPorLista e apagarPorLista", async () => {
    const lista = await repos.listas.salvar({
      id: id(), casaId: casa.id, tipoIda: "mercado_semanal", data: "2026-11-07", status: "rascunho", criadaEm: "2026-11-05T10:00:00Z",
    });
    const outra = id();
    const item = (listaId: string) => ({
      id: id(), casaId: casa.id, listaId, produtoId: id(), quantidadeSugerida: 1, status: "pendente" as const, urgente: false, removido: false, quantidadeEditada: false,
    });
    await repos.itensLista.salvar(item(lista.id));
    await repos.itensLista.salvar(item(lista.id));
    await repos.itensLista.salvar(item(outra));
    expect(await repos.itensLista.listarPorLista(lista.id)).toHaveLength(2);
    await repos.itensLista.apagarPorLista(lista.id);
    expect(await repos.itensLista.listarPorLista(lista.id)).toEqual([]);
    expect(await repos.itensLista.listarPorLista(outra)).toHaveLength(1);
  });

  it("agendas: valida a regra do tipo", async () => {
    await expect(repos.agendas.salvar({ id: id(), casaId: casa.id, tipo: "feira_mensal" })).rejects.toBeInstanceOf(DadoInvalidoError);
    const a = await repos.agendas.salvar({ id: id(), casaId: casa.id, tipo: "feira_mensal", diaDoMes: 5 });
    expect(await repos.agendas.obter(a.id)).toEqual(a);
  });
});

describe("validação Zod", () => {
  it("recusa gravar registro inválido", async () => {
    await expect(repos.produtos.salvar({ ...produto("X"), meta: -1 })).rejects.toBeInstanceOf(DadoInvalidoError);
    expect(await repos.produtos.listar()).toEqual([]);
  });

  it("recusa ler registro corrompido no banco", async () => {
    const db = await abrirBanco({ indexedDB: fabrica });
    const tx = db.transaction("produtos", "readwrite");
    tx.objectStore("produtos").put({ id: id(), nome: "sem campos" });
    await new Promise((r) => (tx.oncomplete = r));
    const outro = criarRepositoriosComBanco(db);
    await expect(outro.produtos.listar()).rejects.toBeInstanceOf(DadoInvalidoError);
    db.close();
  });
});

describe("eventos de mudança", () => {
  it("cada escrita emite a coleção; cancelar para de receber", async () => {
    const vistos: NomeColecao[] = [];
    const cancelar = aoMudar((c) => vistos.push(c));
    const p = await repos.produtos.salvar(produto("A"));
    await repos.produtos.apagar(p.id);
    await repos.itensLista.apagarPorLista(id());
    expect(vistos).toEqual(["produtos", "produtos", "itensLista"]);
    cancelar();
    await repos.produtos.salvar(produto("B"));
    expect(vistos).toHaveLength(3);
  });
});

describe("migrações", () => {
  it("a partir do banco vazio cria todos os stores e índices", async () => {
    const db = await abrirBanco({ indexedDB: new IDBFactory(), nomeBanco: "novo" });
    expect([...db.objectStoreNames].sort()).toEqual(
      ["agendas", "apelidos", "casas", "compras", "conferencias", "estoques", "itensLista", "listas", "mercados", "notasPendentes", "perfis", "produtos"],
    );
    expect(db.version).toBe(MIGRACOES[MIGRACOES.length - 1].versao);
    const tx = db.transaction("compras");
    expect([...tx.objectStore("compras").indexNames].sort()).toEqual(["emissao", "mercadoId"]);
    db.close();
  });

  it("migração nova roda só uma vez e preserva os dados existentes", async () => {
    const aplicar = vi.fn((db: IDBDatabase) => {
      db.createObjectStore("extra", { keyPath: "id" });
    });
    const f = new IDBFactory();
    const r1 = await criarRepositorios({ indexedDB: f, nomeBanco: "m" });
    const c = (await r1.casas.listar())[0];
    r1.fechar();
    const proxima = MIGRACOES.length + 1;
    const migracoes = [...MIGRACOES, { versao: proxima, nome: "extra", aplicar }];
    const db2 = await abrirBanco({ indexedDB: f, nomeBanco: "m", migracoes });
    expect(db2.version).toBe(proxima);
    expect(db2.objectStoreNames.contains("extra")).toBe(true);
    expect(aplicar).toHaveBeenCalledTimes(1);
    expect((await criarRepositoriosComBanco(db2).casas.listar())[0].id).toBe(c.id);
    db2.close();
    const db3 = await abrirBanco({ indexedDB: f, nomeBanco: "m", migracoes });
    expect(aplicar).toHaveBeenCalledTimes(1);
    db3.close();
  });

  it("as migrações são numeradas em sequência, sem lacunas", () => {
    expect(MIGRACOES.map((m) => m.versao)).toEqual(MIGRACOES.map((_, i) => i + 1));
  });
});

describe("backup", () => {
  async function popular() {
    const p = await repos.produtos.salvar(produto("Tomate"));
    const m = await repos.mercados.salvar({
      id: id(), casaId: casa.id, cnpj: "08868231000638", nome: "Cia Santos", endereco: "Olinda", tipo: "hortifruti", transporte: "bike_eletrica",
    });
    await repos.apelidos.salvar({ casaId: casa.id, cnpj: m.cnpj, codigo: "52", produtoId: p.id });
    await repos.compras.salvar(compra(m.id, "2026-11-04T10:33:31"));
    await repos.estoques.salvar({ id: id(), casaId: casa.id, produtoId: p.id, quantidade: 0.5, nivel: "metade", confirmadoEm: "2026-11-05T10:00:00Z" });
    await repos.agendas.salvar({ id: id(), casaId: casa.id, tipo: "mercado_semanal", diaDaSemana: 6 });
    const l = await repos.listas.salvar({ id: id(), casaId: casa.id, tipoIda: "mercado_semanal", data: "2026-11-07", status: "rascunho", criadaEm: "2026-11-05T10:00:00Z" });
    await repos.itensLista.salvar({ id: id(), casaId: casa.id, listaId: l.id, produtoId: p.id, quantidadeSugerida: 2, status: "pendente", urgente: false, removido: false, quantidadeEditada: false });
  }

  it("ida e volta: exportar, importar em outro aparelho e exportar de novo dá o mesmo conteúdo", async () => {
    await popular();
    const arquivo = await exportar(repos, new Date("2026-11-05T12:00:00Z"));
    expect(arquivo).toMatchObject({ versao: VERSAO_BACKUP, exportadoEm: "2026-11-05T12:00:00.000Z" });
    const json = JSON.stringify(arquivo);

    const outro = await criarRepositorios({ indexedDB: new IDBFactory(), nomeBanco: "outro" });
    const resumo = await importar(outro, json);
    expect(resumo).toMatchObject({ produtos: 1, mercados: 1, apelidos: 1, compras: 1, estoques: 1, agendas: 4, listas: 1, itensLista: 1 });
    const volta = await exportar(outro, new Date("2026-11-05T12:00:00Z"));
    const ordenar = (b: typeof arquivo) => JSON.parse(JSON.stringify(b, (_k, v: unknown) => (Array.isArray(v) ? [...v].sort((a, c) => JSON.stringify(a).localeCompare(JSON.stringify(c))) : v)));
    // a casa padrão vazia criada na abertura do outro aparelho é removida ao restaurar
    expect(ordenar(volta).colecoes.produtos).toEqual(ordenar(arquivo).colecoes.produtos);
    expect(ordenar(volta).colecoes.compras).toEqual(ordenar(arquivo).colecoes.compras);
    expect(volta.colecoes.casas.map((c) => c.id)).toContain(casa.id);
    outro.fechar();
  });

  it("importação é idempotente", async () => {
    await popular();
    const json = JSON.stringify(await exportar(repos));
    await importar(repos, json); // a 1ª importação só acrescenta Perfil.ultimoBackupEm
    const antes = await exportar(repos, new Date(0));
    await importar(repos, json);
    const depois = await exportar(repos, new Date(0));
    expect(depois).toEqual(antes);
  });

  it("sobrescreve por id/chave", async () => {
    await popular();
    const arq = await exportar(repos);
    arq.colecoes.produtos[0].meta = 9;
    arq.meta = undefined; // arquivo editado à mão: sem cabeçalho não há soma a conferir (com cabeçalho, seria recusado)
    await importar(repos, JSON.stringify(arq));
    expect((await repos.produtos.listar())[0].meta).toBe(9);
    expect(await repos.produtos.listar()).toHaveLength(1);
  });

  it("rejeita arquivo inválido com mensagem clara e sem gravar nada", async () => {
    await popular();
    const antes = await exportar(repos, new Date(0));
    expect(() => lerBackup("não é json")).toThrow(/JSON válido/);
    expect(() => lerBackup("{}")).toThrow(BackupInvalidoError);
    expect(() => lerBackup("null")).toThrow(BackupInvalidoError);
    const arq = await exportar(repos);
    const ruim = { ...arq, colecoes: { ...arq.colecoes, produtos: [{ ...arq.colecoes.produtos[0], meta: -5 }] } };
    await expect(importar(repos, JSON.stringify(ruim))).rejects.toThrow(/colecoes\.produtos/);
    expect(await exportar(repos, new Date(0))).toEqual(antes);
  });

  it("rejeita versão superior à suportada", async () => {
    const arq = await exportar(repos);
    await expect(importar(repos, JSON.stringify({ ...arq, versao: VERSAO_BACKUP + 1 }))).rejects.toThrow(/mais nova que a suportada/);
  });

  it("não grava CPF nem texto bruto: o backup só contém campos do schema", async () => {
    await popular();
    const json = JSON.stringify(await exportar(repos));
    expect(json).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(json).not.toMatch(/cpf/i);
  });
});

describe("seed da primeira abertura", () => {
  it("cria a agenda inicial (feira dia 5, mercado sábado, hortifruti quarta), uma única vez", async () => {
    const agendas = await repos.agendas.listar();
    expect(agendas.map((a) => [a.tipo, a.diaDoMes ?? a.diaDaSemana]).sort()).toEqual([
      ["feira_mensal", 5], ["hortifruti_semanal", 3], ["mercado_semanal", 6],
    ]);
    await repos.iniciar();
    expect(await repos.agendas.listar()).toHaveLength(3);
  });

  it("reabrir não recria o que o usuário apagou", async () => {
    const [primeira] = await repos.agendas.listar();
    await repos.agendas.apagar(primeira.id);
    repos.fechar();
    repos = await criarRepositorios({ indexedDB: fabrica });
    expect(await repos.agendas.listar()).toHaveLength(2);
  });
});

describe("restaurar backup em aparelho novo", () => {
  it("não deixa duas casas nem agendas duplicadas", async () => {
    await repos.produtos.salvar(produto("Tomate"));
    const json = JSON.stringify(await exportar(repos));
    const novo = await criarRepositorios({ indexedDB: new IDBFactory(), nomeBanco: "aparelho-novo" });
    const casaVazia = (await novo.casas.listar())[0];
    expect(casaVazia.id).not.toBe(casa.id);
    await importar(novo, json);
    const casas = await novo.casas.listar();
    expect(casas.map((c) => c.id)).toEqual([casa.id]);
    expect(await novo.agendas.listar()).toHaveLength(3);
    expect(await novo.perfis.listar()).toHaveLength(1);
    expect((await novo.iniciar()).id).toBe(casa.id);
    novo.fechar();
  });

  it("não apaga a casa local quando ela já tem dados", async () => {
    const outro = await criarRepositorios({ indexedDB: new IDBFactory(), nomeBanco: "com-dados" });
    const local = (await outro.casas.listar())[0];
    await outro.produtos.salvar({ ...produto("Local"), casaId: local.id });
    await importar(outro, JSON.stringify(await exportar(repos)));
    expect((await outro.casas.listar()).map((c) => c.id).sort()).toEqual([casa.id, local.id].sort());
    outro.fechar();
  });
});

describe("migração 002 (conferências)", () => {
  it("um banco criado só com a 001 é atualizado sem perder dados", async () => {
    const f = new IDBFactory();
    const v1 = await abrirBanco({ indexedDB: f, nomeBanco: "antigo", migracoes: [MIGRACOES[0]] });
    expect(v1.objectStoreNames.contains("conferencias")).toBe(false);
    const antigo = criarRepositoriosComBanco(v1);
    const c = await antigo.casas.salvar({ id: crypto.randomUUID(), nome: "Casa antiga" });
    v1.close();
    const novo = await criarRepositorios({ indexedDB: f, nomeBanco: "antigo" });
    expect((await novo.casas.obter(c.id))?.nome).toBe("Casa antiga");
    const reg = await novo.conferencias.salvar({
      id: crypto.randomUUID(), casaId: c.id, tipoIda: "mercado_semanal", iniciadaEm: "2026-11-05T10:00:00Z", duracaoSegundos: 95, produtosConferidos: 8, rupturas: 0,
    });
    expect(await novo.conferencias.obter(reg.id)).toEqual(reg);
    novo.fechar();
  });

  it("backup anterior à 002 (sem 'conferencias') ainda é aceito", async () => {
    const arquivo = JSON.parse(JSON.stringify(await exportar(repos)));
    delete arquivo.colecoes.conferencias;
    expect(lerBackup(JSON.stringify(arquivo)).colecoes.conferencias).toEqual([]);
  });

  it("registro de conferência valida os campos", async () => {
    await expect(
      repos.conferencias.salvar({ id: crypto.randomUUID(), casaId: casa.id, tipoIda: "mercado_semanal", iniciadaEm: "2026-11-05T10:00:00Z", duracaoSegundos: -1, produtosConferidos: 0, rupturas: 0 }),
    ).rejects.toBeInstanceOf(DadoInvalidoError);
  });
});
