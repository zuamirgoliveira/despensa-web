// Despensa: quantidade atual como base (docs/proposta-despensa.md). Funções puras.
import { quantidadeReferencia, fracaoDoNivel } from "./estoque";
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
