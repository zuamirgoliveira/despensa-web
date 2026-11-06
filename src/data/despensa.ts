// Operações da despensa sobre a quantidade atual (somar, subtrair, ajustar, recorrência). Tudo passa pelo repositório.
import { nivelDeQuantidade, quantidadePadrao } from "@/domain/despensa";
import { padraoSugerido, promoverARecorrente, rebaixarDeRecorrente } from "@/domain/recorrencia";
import type { Compra, Estoque, Produto } from "@/domain/types";
import type { Repositorios } from "./repositorios";

const arred = (n: number): number => Math.max(0, Math.round(n * 1000) / 1000);

export type Linha = { produtoId: string; quantidade: number };

/** Soma as quantidades por produto (itens repetidos viram uma linha). */
export function agruparLinhas(itens: readonly { produtoId?: string; quantidade: number }[]): Linha[] {
  const m = new Map<string, number>();
  for (const i of itens) if (i.produtoId) m.set(i.produtoId, (m.get(i.produtoId) ?? 0) + i.quantidade);
  return [...m].map(([produtoId, quantidade]) => ({ produtoId, quantidade: arred(quantidade) }));
}

/** Grava a quantidade atual de um produto (cria o registro se não existe) e o rótulo de nível pelo padrão. */
export async function definirQuantidade(
  repos: Repositorios,
  produto: Pick<Produto, "id" | "casaId" | "meta">,
  quantidade: number,
  agora: Date = new Date(),
): Promise<Estoque> {
  const atual = await repos.estoques.obterPorProduto(produto.id);
  const q = arred(quantidade);
  return repos.estoques.salvar({
    ...(atual ?? { id: crypto.randomUUID(), casaId: produto.casaId, produtoId: produto.id }),
    quantidade: q,
    nivel: nivelDeQuantidade(q, quantidadePadrao(produto)) ?? (q > 0 ? "cheio" : "acabou"),
    quantidadeExata: undefined,
    confirmadoEm: agora.toISOString(),
  });
}

/** Soma (ou subtrai, com `sinal` -1) quantidades ao estoque; nunca abaixo de zero. Devolve quantos produtos mudaram. */
export async function ajustarEstoque(repos: Repositorios, linhas: readonly Linha[], sinal: 1 | -1, agora: Date = new Date()): Promise<number> {
  let mudou = 0;
  for (const l of linhas) {
    const produto = await repos.produtos.obter(l.produtoId);
    if (!produto || l.quantidade <= 0) continue;
    const atual = (await repos.estoques.obterPorProduto(l.produtoId))?.quantidade ?? 0;
    const novo = arred(atual + sinal * l.quantidade);
    if (novo === atual) continue;
    await definirQuantidade(repos, produto, novo, agora);
    mudou++;
  }
  return mudou;
}

export type EfeitoNoEstoque = { produtoId: string; nome: string; de: number; para: number };

/** O que apagar a compra faz na despensa: cada produto perde o que a nota somou (nunca abaixo de zero). */
export async function efeitoDeApagarCompra(repos: Repositorios, compra: Pick<Compra, "itens">): Promise<EfeitoNoEstoque[]> {
  const efeitos: EfeitoNoEstoque[] = [];
  for (const l of agruparLinhas(compra.itens)) {
    const produto = await repos.produtos.obter(l.produtoId);
    const estoque = await repos.estoques.obterPorProduto(l.produtoId);
    if (!produto || !estoque) continue;
    const para = arred(estoque.quantidade - l.quantidade);
    if (para !== estoque.quantidade) efeitos.push({ produtoId: produto.id, nome: produto.nome, de: estoque.quantidade, para });
  }
  return efeitos;
}

/** Apaga a compra e desfaz a soma na despensa (ver `efeitoDeApagarCompra`). */
export async function apagarCompraDesfazendoEstoque(repos: Repositorios, compra: Compra): Promise<EfeitoNoEstoque[]> {
  const efeitos = await efeitoDeApagarCompra(repos, compra);
  await ajustarEstoque(repos, agruparLinhas(compra.itens), -1);
  await repos.compras.apagar(compra.chave);
  return efeitos;
}

/** "Repor sempre": promove o item a recorrente com o padrão informado (ou o sugerido pelas compras). */
export async function reporSempre(repos: Repositorios, produtoId: string, padrao?: number): Promise<Produto | undefined> {
  const p = await repos.produtos.obter(produtoId);
  if (!p) return undefined;
  const sugerido = padraoSugerido(p, await repos.compras.listar());
  return repos.produtos.salvar(promoverARecorrente(p, padrao, sugerido));
}

/** "Deixar de repor": o item sai da regra da lista; quantidade, padrão e histórico ficam. */
export async function deixarDeRepor(repos: Repositorios, produtoId: string): Promise<Produto | undefined> {
  const p = await repos.produtos.obter(produtoId);
  return p ? repos.produtos.salvar(rebaixarDeRecorrente(p)) : undefined;
}
