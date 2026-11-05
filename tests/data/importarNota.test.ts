import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarRepositorios } from "@/data/indexeddb";
import { NotaDuplicadaError, prepararConferencia, salvarNotaImportada } from "@/data/importarNota";
import { parseNota } from "@/domain/nfce/parser";
import type { Repositorios } from "@/data/repositorios";

const texto = readFileSync(new URL("../fixtures/notas/cia-santos-hortifruti.txt", import.meta.url), "utf8");
const { nota } = parseNota(texto);
const CHAVE = nota.chave as string;
let repos: Repositorios;

beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

const nomesSugeridos = async () =>
  Object.fromEntries((await prepararConferencia(repos, nota)).map((i) => [i.codigo, i.sugestaoNome]));

describe("importação da nota de exemplo", () => {
  it("conferência inicial: 16 itens novos com nome sugerido", async () => {
    const itens = await prepararConferencia(repos, nota);
    expect(itens).toHaveLength(16);
    expect(itens.every((i) => i.novo)).toBe(true);
    expect(itens[0]).toMatchObject({ codigo: "0000000000052", sugestaoNome: "Melao Japones", novo: true });
    expect(itens.find((i) => i.descricao.startsWith("ALHO"))?.sugestaoNome).toBe("Alho Redinha");
  });

  it("salva mercado, compra, apelidos e 16 produtos", async () => {
    const r = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos(), agora: new Date("2026-11-05T12:00:00Z") });
    expect(r.mercado).toMatchObject({ cnpj: "08868231000638", tipo: "hortifruti", transporte: "carro" });
    expect(r.compra).toMatchObject({ chave: CHAVE, emissao: "2026-11-04T10:33:31", valorTotalCentavos: 7724, pagamento: "Cartão de Crédito" });
    expect(r.compra.itens).toHaveLength(16);
    expect(r.compra.itens.every((i) => i.produtoId)).toBe(true);
    expect(r.produtosCriados).toHaveLength(16);
    expect(await repos.produtos.listar()).toHaveLength(16);
    expect(await repos.apelidos.listarPorCnpj("08868231000638")).toHaveLength(16);
    expect(await repos.mercados.listar()).toHaveLength(1);
    expect(await repos.compras.listar()).toHaveLength(1);
  });

  it("não persiste CPF nem o texto bruto", async () => {
    await salvarNotaImportada(repos, { nota: { ...nota, cpfNaNota: true }, chave: CHAVE, nomes: await nomesSugeridos() });
    const tudo = JSON.stringify(await repos.compras.listar()) + JSON.stringify(await repos.mercados.listar());
    expect(tudo).not.toMatch(/cpf/i);
    expect(tudo).not.toContain("Consumidor");
    expect(tudo).not.toContain("Protocolo");
  });

  it("nota duplicada é bloqueada; substituir sobrescreve sem duplicar nada", async () => {
    await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos() });
    await expect(salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos() })).rejects.toBeInstanceOf(NotaDuplicadaError);
    const r = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos(), substituir: true });
    expect(r.produtosCriados).toHaveLength(0);
    expect(await repos.compras.listar()).toHaveLength(1);
    expect(await repos.produtos.listar()).toHaveLength(16);
    expect(await repos.mercados.listar()).toHaveLength(1);
  });

  it("apelido lembrado: na segunda conferência os itens não são novos e usam o nome escolhido", async () => {
    const nomes = { ...(await nomesSugeridos()), "0000000000052": "Melão" };
    await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes });
    const itens = await prepararConferencia(repos, nota);
    expect(itens.every((i) => !i.novo)).toBe(true);
    expect(itens[0].sugestaoNome).toBe("Melão");
  });

  it("nome já existente no catálogo (sem acento/caixa) reutiliza o produto", async () => {
    await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos() });
    const outraChave = CHAVE.slice(0, 43) + "1"; // chave só para o teste de armazenamento
    const nomes = { ...(await nomesSugeridos()), "0000000000052": "MELAO japones" };
    const r = await salvarNotaImportada(repos, { nota, chave: outraChave, nomes });
    expect(r.produtosCriados).toHaveLength(0);
    expect(await repos.produtos.listar()).toHaveLength(16);
  });

  it("item sem nome digitado usa a sugestão", async () => {
    const r = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: {} });
    expect(r.produtosCriados.map((p) => p.nome)).toContain("Melao Japones");
  });

  it("sem data de emissão não salva", async () => {
    await expect(salvarNotaImportada(repos, { nota: { ...nota, emissao: null }, chave: CHAVE, nomes: {} })).rejects.toThrow(/emissão/);
    expect(await repos.mercados.listar()).toHaveLength(0);
    expect(await repos.produtos.listar()).toHaveLength(0);
  });
});
