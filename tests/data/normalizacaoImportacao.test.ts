// Mesmo produto escrito de jeitos diferentes, em mercados e meses diferentes: um produto só quando
// a identidade (nome normalizado + tamanho) é igual; parecido apenas sugere.
import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarRepositorios } from "@/data/indexeddb";
import { prepararConferencia, salvarNotaImportada } from "@/data/importarNota";
import { finalizarCompra } from "@/data/reconciliacao";
import type { Repositorios } from "@/data/repositorios";
import { parseNota, type NotaParseada } from "@/domain/nfce/parser";

const base = parseNota(readFileSync(new URL("../fixtures/notas/cia-santos-hortifruti.txt", import.meta.url), "utf8")).nota;
const item0 = base.itens[0];
let repos: Repositorios;

beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

/** Nota de um mercado (CNPJ) com um único item. */
function nota(cnpj: string, descricao: string, codigo: string, quantidade: number, emissao: string): NotaParseada {
  return {
    ...base,
    loja: { ...base.loja, cnpj, nome: `MERCADO ${cnpj.slice(-2)}` },
    emissao,
    itens: [{ ...item0, codigo, descricao, unidade: "UNID", quantidade, valorUnitarioCentavos: 800, valorTotalCentavos: 800 * quantidade }],
  };
}
let seq = 0;
const chave = (): string => String(++seq).padStart(44, "0");
const importar = async (n: NotaParseada, nomes?: Record<string, string>) => {
  const itens = await prepararConferencia(repos, n);
  const escolhidos = nomes ?? Object.fromEntries(itens.map((i) => [i.codigo, i.sugestaoNome]));
  const r = await salvarNotaImportada(repos, { nota: n, chave: chave(), nomes: escolhidos });
  await finalizarCompra(repos, r.compra, undefined); // produtos comprados voltam a "cheio"
  return { itens, r };
};
const Z = "11111111000191";
const Y = "22222222000191";

describe("mesmo produto em mercados e meses diferentes", () => {
  it("marcas diferentes são produtos diferentes e não são sugeridos um ao outro", async () => {
    await importar(nota(Z, "MAIONESE HELMAZ 500G", "A1", 2, "2026-10-05T10:00:00"));
    const { itens } = await importar(nota(Y, "MAIONESE LIZA 500 G", "B1", 2, "2026-11-05T10:00:00"));
    expect(itens[0]).toMatchObject({ sugestaoNome: "Maionese Liza 500g", novo: true, parecidos: [] });
    expect((await repos.produtos.listar()).map((p) => p.nome).sort()).toEqual(["Maionese Helmaz 500g", "Maionese Liza 500g"]);
  });

  it("a mesma maionese escrita de outro jeito (outro código, outro mercado) cai no mesmo produto", async () => {
    await importar(nota(Y, "Maionese LIZA 500g", "B1", 2, "2026-10-05T10:00:00"));
    const { itens, r } = await importar(nota(Z, "maionese liza 500 g", "A9", 1, "2026-11-05T10:00:00"));
    expect(itens[0]).toMatchObject({ sugestaoNome: "Maionese Liza 500g", novo: false, parecidos: [] });
    expect(r.produtosCriados).toHaveLength(0);
    const produtos = await repos.produtos.listar();
    expect(produtos).toHaveLength(1);
    // os dois códigos (um por mercado) apontam para o produto único; a meta é a média por compra: (2 + 1) / 2
    expect(await repos.apelidos.listarPorProduto(produtos[0].id)).toHaveLength(2);
    expect(produtos[0].meta).toBe(1.5);
    // um único registro de estoque (nível "cheio"), não um por escrita do nome
    expect((await repos.estoques.listar()).filter((e) => e.produtoId === produtos[0].id)).toMatchObject([{ nivel: "cheio" }]);
  });

  it("produto antigo com nome escrito à mão ('maionese liza 500 g') também é reconhecido", async () => {
    await importar(nota(Y, "x", "B1", 1, "2026-10-05T10:00:00"), { B1: "maionese liza 500 g" });
    const { itens, r } = await importar(nota(Z, "MAIONESE LIZA 500GR", "A1", 1, "2026-11-05T10:00:00"));
    expect(itens[0].novo).toBe(false);
    expect(r.produtosCriados).toHaveLength(0);
    expect(await repos.produtos.listar()).toHaveLength(1);
  });

  it("sem o tamanho na nota: sugere o produto com tamanho e o usuário escolhe (nada une sozinho)", async () => {
    await importar(nota(Y, "MAIONESE LIZA 500G", "B1", 2, "2026-10-05T10:00:00"));
    const n = nota(Z, "MAIONESE LIZA", "A1", 2, "2026-11-05T10:00:00");
    const itens = await prepararConferencia(repos, n);
    expect(itens[0]).toMatchObject({ sugestaoNome: "Maionese Liza", novo: true });
    expect(itens[0].parecidos).toEqual([{ nome: "Maionese Liza 500g", motivo: "tamanho" }]);

    // sem escolher: vira um segundo produto
    const sozinho = await salvarNotaImportada(repos, { nota: n, chave: chave(), nomes: { A1: "Maionese Liza" } });
    expect(sozinho.produtosCriados).toHaveLength(1);
    expect(await repos.produtos.listar()).toHaveLength(2);
  });

  it("escolhendo o nome sugerido, usa o produto existente", async () => {
    await importar(nota(Y, "MAIONESE LIZA 500G", "B1", 2, "2026-10-05T10:00:00"));
    const n = nota(Z, "MAIONESE LIZA", "A1", 2, "2026-11-05T10:00:00");
    const r = await salvarNotaImportada(repos, { nota: n, chave: chave(), nomes: { A1: "Maionese Liza 500g" } });
    expect(r.produtosCriados).toHaveLength(0);
    expect(await repos.produtos.listar()).toHaveLength(1);
    // na próxima nota do mercado Z, o código A1 já vem ligado ao produto certo (apelido)
    const proxima = await prepararConferencia(repos, nota(Z, "MAIONESE LIZA", "A1", 1, "2026-12-05T10:00:00"));
    expect(proxima[0]).toMatchObject({ sugestaoNome: "Maionese Liza 500g", novo: false });
  });
});
