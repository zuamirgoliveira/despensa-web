// Despensa: quantidade atual como base (docs/proposta-despensa.md). Funções puras.
import { fracaoDoNivel, quantidadeReferencia } from "./estoque";
import { arredondarParaCima, passoDaUnidade, ultimoPrecoUnitario, type ItemListaSugerido, type ResumoLista } from "./lista";
import type { Compra, Estoque, Nivel, Produto } from "./types";

/** Estoque gravado antes da quantidade numérica existir (migração 003 e backups v1/v2). */
export type EstoqueLegado = Omit<Estoque, "quantidade"> & { quantidade?: number };

/** Atalho de nível → número: fração do nível × quantidade padrão (ou de referência). */
export function quantidadeDoNivel(nivel: Nivel, referencia: number): number {
  return fracaoDoNivel(nivel) * referencia;
}

/**
 * Converte o estoque por nível em número. Prioridade: `quantidade` já existente, `quantidadeExata`,
 * nível × referência (meta; sem meta, a última quantidade comprada; sem nenhuma, 0 — salvo `cheio`/`metade`
 * sem referência, que ficam 0 por não haver base numérica).
 */
export function converterEstoqueLegado(
  e: EstoqueLegado,
  produto: Pick<Produto, "id" | "meta"> | undefined,
  compras: readonly Compra[],
): Estoque {
  if (e.quantidade !== undefined) return { ...e, quantidade: e.quantidade };
  if (e.quantidadeExata !== undefined) return { ...e, quantidade: e.quantidadeExata };
  const ref = produto ? quantidadeReferencia(produto, compras) : 0;
  return { ...e, quantidade: quantidadeDoNivel(e.nivel, ref) };
}

/** Tolerância de ponto flutuante nas comparações de quantidade. */
const EPS = 1e-9;

/** Fração do padrão abaixo da qual um item recorrente vai para a lista de compras (50%). */
export const FRACAO_PARA_REPOR = 0.5;

/**
 * Onde o item está em relação ao padrão. `sem_registro`: ainda ninguém informou a quantidade.
 * `abaixo`: menos de 50% do padrão (entra na lista). `parcial`: de 50% até o padrão (ainda não repõe).
 */
export type SituacaoItem = "sem_registro" | "zerado" | "abaixo" | "parcial" | "ok" | "acima";

/** Quantidade padrão do item: `Produto.meta` quando há (> 0). */
export function quantidadePadrao(produto: Pick<Produto, "meta">): number | undefined {
  return produto.meta > 0 ? produto.meta : undefined;
}

export function situacaoDoItem(produto: Pick<Produto, "meta">, estoque: Pick<Estoque, "quantidade"> | undefined): SituacaoItem {
  if (!estoque) return "sem_registro";
  if (estoque.quantidade <= EPS) return "zerado";
  const padrao = quantidadePadrao(produto);
  if (padrao === undefined) return "ok";
  if (estoque.quantidade < padrao * FRACAO_PARA_REPOR - EPS) return "abaixo";
  if (estoque.quantidade < padrao - EPS) return "parcial";
  return estoque.quantidade > padrao + EPS ? "acima" : "ok";
}

/** Quanto falta para chegar ao padrão (`padrão − atual`, nunca negativo). `undefined` sem padrão ou sem registro. */
export function quantidadeQueFalta(produto: Pick<Produto, "meta">, estoque: Pick<Estoque, "quantidade"> | undefined): number | undefined {
  const padrao = quantidadePadrao(produto);
  if (!estoque || padrao === undefined) return undefined;
  return Math.max(0, Math.round((padrao - estoque.quantidade) * 1000) / 1000);
}

/** Rótulo de atalho para uma quantidade (limiares da conferência). Sem padrão não há como rotular. */
export function nivelDeQuantidade(quantidade: number, padrao: number | undefined): Nivel | undefined {
  if (padrao === undefined || padrao <= 0) return undefined;
  const f = quantidade / padrao;
  if (f >= 0.75) return "cheio";
  if (f >= 0.35) return "metade";
  return f > 0.05 ? "acabando" : "acabou";
}

export type ListaDaCasa = {
  itens: ItemListaSugerido[];
  resumo: ResumoLista;
  /** Itens não recorrentes que zeraram: não entram na lista, só viram aviso ("Repor sempre?"). */
  naoRecorrentesZerados: string[];
};

/**
 * Lista única da casa (decisão de 06/11/2026): itens **recorrentes**, ativos e com registro de quantidade
 * que estão zerados (quantidade = padrão, ou a última comprada, ou uma unidade mínima) ou com **menos de 50% do
 * padrão** (quantidade = padrão − atual, arredondada para cima ao passo da unidade). De 50% para cima nunca entra.
 * Ordem: zerados primeiro, depois do mais vazio ao menos vazio (fração do padrão), empate por nome.
 * Não depende de agenda, ida nem consumo. Só existe uma lista; o que não foi comprado segue faltando.
 */
export function gerarListaDaCasa(entrada: {
  produtos: readonly Produto[];
  estoques: readonly Estoque[];
  compras: readonly Compra[];
}): ListaDaCasa {
  const porProduto = new Map(entrada.estoques.map((e) => [e.produtoId, e]));
  const itens: ItemListaSugerido[] = [];
  const semPreco: string[] = [];
  const naoRecorrentesZerados: string[] = [];
  const ordem = new Map<string, { fracao: number; nome: string }>();
  let total = 0;

  for (const p of entrada.produtos) {
    if (!p.ativo) continue;
    const estoque = porProduto.get(p.id);
    const situacao = situacaoDoItem(p, estoque);
    if (situacao !== "zerado" && situacao !== "abaixo") continue;
    if (!p.recorrente) {
      if (situacao === "zerado") naoRecorrentesZerados.push(p.id);
      continue;
    }
    const passo = passoDaUnidade(p.unidade);
    const bruta = situacao === "zerado" ? (quantidadePadrao(p) ?? quantidadeReferencia(p, entrada.compras)) : (quantidadeQueFalta(p, estoque) ?? 0);
    const quantidade = Math.max(passo, arredondarParaCima(bruta, passo));
    const item: ItemListaSugerido = { produtoId: p.id, quantidade, motivo: situacao === "zerado" ? "acabou" : "abaixo", urgente: false };
    const preco = ultimoPrecoUnitario(p.id, entrada.compras);
    if (preco === undefined) semPreco.push(p.id);
    else {
      item.precoEstimadoCentavos = Math.round(quantidade * preco);
      total += item.precoEstimadoCentavos;
    }
    itens.push(item);
    const padrao = quantidadePadrao(p);
    ordem.set(p.id, { fracao: situacao === "zerado" || padrao === undefined ? 0 : (estoque?.quantidade ?? 0) / padrao, nome: p.nome });
  }
  itens.sort((a, b) => {
    const [x, y] = [ordem.get(a.produtoId), ordem.get(b.produtoId)];
    return (x?.fracao ?? 0) - (y?.fracao ?? 0) || (x?.nome ?? "").localeCompare(y?.nome ?? "", "pt-BR");
  });
  return { itens, resumo: { totalEstimadoCentavos: total, semPreco, avisos: [] }, naoRecorrentesZerados };
}
