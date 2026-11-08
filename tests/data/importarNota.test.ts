import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarRepositorios } from "@/data/indexeddb";
import { NotaDuplicadaError, prepararConferencia, salvarNotaImportada, situacaoDosProdutos } from "@/data/importarNota";
import { parseNota } from "@/domain/nfce/parser";
import type { Repositorios } from "@/data/repositorios";
import { finalizarCompra } from "@/data/reconciliacao";
import { chaveDeProduto } from "@/domain/normalizacao";
import type { Produto } from "@/domain/types";

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

describe("itens casados com o catálogo", () => {
  it("primeira importação: nenhum casado; segunda: todos; substituir mantém o valor da primeira", async () => {
    const a = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos() });
    expect(a.compra.itensCasados).toBe(0);
    const b = await salvarNotaImportada(repos, { nota: { ...nota, emissao: "2026-11-11T10:00:00" }, chave: "26261108868231000638650020000689041020778728", nomes: {} });
    expect(b.compra.itensCasados).toBe(16);
    const c = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: {}, substituir: true });
    expect(c.compra.itensCasados).toBe(0);
  });
});

describe("importação soma à despensa (D-06)", () => {
  it("produto novo nasce não recorrente, com a quantidade comprada no estoque", async () => {
    const r = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos() });
    await finalizarCompra(repos, r.compra, undefined);
    expect((await repos.produtos.listar()).every((p) => !p.recorrente)).toBe(true);
    const melao = r.produtosCriados.find((p) => p.nome === "Melao Japones") as Produto;
    const qtd = nota.itens.find((i) => i.codigo === "0000000000052")?.quantidade;
    expect((await repos.estoques.obterPorProduto(melao.id))?.quantidade).toBe(qtd);
  });

  it("segunda compra do mesmo produto soma; reimportar não soma de novo", async () => {
    const nomes = await nomesSugeridos();
    const r1 = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes });
    await finalizarCompra(repos, r1.compra, undefined);
    const melao = r1.produtosCriados.find((p) => p.nome === "Melao Japones") as Produto;
    const q = nota.itens.find((i) => i.codigo === "0000000000052")?.quantidade as number;

    const outra = { ...nota, emissao: "2026-11-11T10:00:00" };
    const chave2 = "26261108868231000638650020000689041020778721";
    const r2 = await salvarNotaImportada(repos, { nota: outra, chave: chave2, nomes });
    await finalizarCompra(repos, r2.compra, undefined, new Date("2026-11-12T12:00:00Z"));
    expect((await repos.estoques.obterPorProduto(melao.id))?.quantidade).toBeCloseTo(q * 2, 3);

    const anterior = await repos.compras.obter(chave2);
    const r3 = await salvarNotaImportada(repos, { nota: outra, chave: chave2, nomes, substituir: true });
    await finalizarCompra(repos, r3.compra, undefined, new Date("2026-11-12T12:00:00Z"), anterior);
    expect((await repos.estoques.obterPorProduto(melao.id))?.quantidade).toBeCloseTo(q * 2, 3);
  });

  it("\"Repor sempre\" promove só os itens marcados, com o padrão sugerido", async () => {
    const r = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos(), reporSempre: ["0000000000052"] });
    const produtos = await repos.produtos.listar();
    expect(produtos.filter((p) => p.recorrente).map((p) => p.nome)).toEqual(["Melao Japones"]);
    expect(r.compra.itens).toHaveLength(16);
  });

  it("item ignorado fica na nota, sem produto, apelido nem estoque", async () => {
    const r = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos(), ignorar: ["0000000000052"] });
    await finalizarCompra(repos, r.compra, undefined);
    expect(r.compra.itens).toHaveLength(16);
    expect(r.compra.itens.find((i) => i.codigo === "0000000000052")?.produtoId).toBeUndefined();
    expect(await repos.produtos.listar()).toHaveLength(15);
    expect(await repos.apelidos.listarPorCnpj("08868231000638")).toHaveLength(15);
    expect(await repos.estoques.listar()).toHaveLength(15);
  });

  it("situacaoDosProdutos mostra a quantidade atual e a recorrência por nome", async () => {
    const r = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes: await nomesSugeridos(), reporSempre: ["0000000000052"] });
    await finalizarCompra(repos, r.compra, undefined);
    const s = await situacaoDosProdutos(repos);
    expect(s[chaveDeProduto("Melao Japones")]).toMatchObject({ recorrente: true });
    expect(s[chaveDeProduto("Alho Redinha")]).toMatchObject({ recorrente: false });
  });
});

describe("tamanho e 'vendido por unidade' na importação", () => {
  it("guarda o tamanho do nome no item e marca o produto vendido por unidade", async () => {
    const nomes = await nomesSugeridos();
    const [c1, c2] = nota.itens.map((i) => i.codigo);
    nomes[c1] = `${nomes[c1]} 2l`;
    const r = await salvarNotaImportada(repos, { nota, chave: CHAVE, nomes, porUnidade: [c2] });
    expect(r.compra.itens.find((i) => i.codigo === c1)?.tamanho).toEqual({ valor: 2000, medida: "ml" });
    const p2 = await repos.produtos.obter(r.compra.itens.find((i) => i.codigo === c2)?.produtoId as string);
    expect(p2?.vendidoPorUnidade).toBe(true);
  });
});
