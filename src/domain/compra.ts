// Modo compra: totais, progresso e orçamento durante a ida ao mercado (RF-601 a RF-604).
import type { ItemLista } from "./types";

const CONTA_COMO_PEGO = new Set<ItemLista["status"]>(["pego", "extra"]);

/** Quantidade efetivamente pega (a editada no mercado ou, sem edição, a sugerida). */
export function quantidadeDoItem(i: Pick<ItemLista, "quantidadePega" | "quantidadeSugerida">): number {
  return i.quantidadePega ?? i.quantidadeSugerida;
}

/** Total corrente: soma de quantidade pega × preço unitário informado. Itens sem preço ficam fora. */
export function totalCorrente(itens: readonly ItemLista[]): number {
  let total = 0;
  for (const i of itens) {
    if (!i.removido && CONTA_COMO_PEGO.has(i.status) && i.precoCentavos !== undefined) {
      total += Math.round(quantidadeDoItem(i) * i.precoCentavos);
    }
  }
  return total;
}

export type Progresso = { pegos: number; total: number };

/** Itens pegos (ou extras) sobre o total de itens ativos da lista. */
export function progressoDaCompra(itens: readonly ItemLista[]): Progresso {
  const ativos = itens.filter((i) => !i.removido);
  return { pegos: ativos.filter((i) => CONTA_COMO_PEGO.has(i.status)).length, total: ativos.length };
}

/** Pendentes primeiro; pegos vão para o fim. A ordem original é mantida dentro de cada grupo. */
export function ordenarParaCompra<T extends { item: ItemLista }>(itens: readonly T[]): T[] {
  const peso = (i: ItemLista): number => (CONTA_COMO_PEGO.has(i.status) ? 2 : i.status === "pendente" ? 0 : 1);
  return itens.map((v, idx) => ({ v, idx })).sort((a, b) => peso(a.v.item) - peso(b.v.item) || a.idx - b.idx).map((x) => x.v);
}

export type EstadoOrcamento = "sem_orcamento" | "dentro" | "perto" | "estourou";

/** `perto` a partir de 90% do orçamento; `estourou` quando passa de 100%. */
export function estadoDoOrcamento(total: number, orcamentoCentavos: number | undefined): EstadoOrcamento {
  if (!orcamentoCentavos || orcamentoCentavos <= 0) return "sem_orcamento";
  if (total > orcamentoCentavos) return "estourou";
  return total >= orcamentoCentavos * 0.9 ? "perto" : "dentro";
}
