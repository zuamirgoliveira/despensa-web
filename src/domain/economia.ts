// Economia líquida e divisão da lista entre mercados (AGENTS.md 6.6). Centavos.
import type { ComparacaoProduto } from "./comparacao";
import { custoIdaDoMercado } from "./ida";
import type { AgendaIda, Compra, ItemLista, Mercado, Perfil, TipoIda } from "./types";

/** Economia líquida = economia de preço − custo da ida extra. */
export function economiaLiquida(economiaPrecoCentavos: number, custoIdaExtraCentavos: number): number {
  return economiaPrecoCentavos - custoIdaExtraCentavos;
}

/** Mercado habitual de uma ida: o da agenda; sem ele, o mais usado nas compras. */
export function mercadoHabitual(agendas: readonly Pick<AgendaIda, "tipo" | "mercadoId">[], tipo: TipoIda, compras: readonly Pick<Compra, "mercadoId">[]): string | undefined {
  const daAgenda = agendas.find((a) => a.tipo === tipo)?.mercadoId;
  if (daAgenda) return daAgenda;
  const uso = new Map<string, number>();
  for (const c of compras) uso.set(c.mercadoId, (uso.get(c.mercadoId) ?? 0) + 1);
  return [...uso.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

export type PropostaDivisao = {
  mercadoAlternativoId: string;
  /** Itens que passariam para o mercado alternativo (só os que ficam mais baratos lá). */
  produtoIds: string[];
  economiaPrecoCentavos: number;
  custoIdaExtraCentavos: number;
  economiaLiquidaCentavos: number;
};

type ItemParaDividir = Pick<ItemLista, "produtoId" | "quantidadeSugerida" | "removido">;

/**
 * Propõe dividir a lista só quando a economia LÍQUIDA (preço − ida extra) é positiva e passa do mínimo
 * (padrão R$ 5,00). Para cada mercado alternativo com custo de ida conhecido, soma o que se economiza nos
 * itens que lá são mais baratos que no habitual (economia percentual aplicada ao gasto no habitual) e
 * desconta a ida extra; fica a melhor alternativa. Sem custo de ida conhecido, o mercado não é avaliado.
 */
export function proporDivisao(args: {
  itens: readonly ItemParaDividir[];
  habitualId: string;
  mercados: readonly Mercado[];
  comparacoes: ReadonlyMap<string, ComparacaoProduto>;
  perfil: Pick<Perfil, "carro" | "bikeCentavosPorKm" | "economiaMinimaDivisaoCentavos">;
}): PropostaDivisao | undefined {
  const { itens, habitualId, mercados, comparacoes, perfil } = args;
  let melhor: PropostaDivisao | undefined;
  for (const alt of mercados) {
    if (alt.id === habitualId) continue;
    const custoExtra = custoIdaDoMercado(alt, perfil);
    if (custoExtra === undefined) continue;
    let economia = 0;
    const produtoIds: string[] = [];
    for (const i of itens) {
      if (i.removido || !i.produtoId) continue;
      const c = comparacoes.get(i.produtoId);
      const noHabitual = c?.mercados.find((m) => m.mercadoId === habitualId);
      const noAlt = c?.mercados.find((m) => m.mercadoId === alt.id);
      if (!noHabitual || !noAlt || noAlt.normalizadoCentavos >= noHabitual.normalizadoCentavos || noHabitual.normalizadoCentavos <= 0) continue;
      const gasto = i.quantidadeSugerida * noHabitual.precoCentavos;
      economia += gasto * ((noHabitual.normalizadoCentavos - noAlt.normalizadoCentavos) / noHabitual.normalizadoCentavos);
      produtoIds.push(i.produtoId);
    }
    const economiaPreco = Math.round(economia);
    const liquida = economiaLiquida(economiaPreco, custoExtra);
    if (liquida > 0 && liquida >= perfil.economiaMinimaDivisaoCentavos && (!melhor || liquida > melhor.economiaLiquidaCentavos)) {
      melhor = { mercadoAlternativoId: alt.id, produtoIds, economiaPrecoCentavos: economiaPreco, custoIdaExtraCentavos: custoExtra, economiaLiquidaCentavos: liquida };
    }
  }
  return melhor;
}

/** Custo da ida a partir do qual (em % do total estimado) a ida é pouco vantajosa. */
export const LIMITE_CUSTO_IDA_PCT = 40;
/** Menos que isto de itens torna a ida pouco vantajosa. */
export const MIN_ITENS_IDA = 5;

export type AvisoIda = { motivos: ("custo_alto" | "poucos_itens")[] };

/** Ida pouco vantajosa: custo da ida ≥ 40% do total estimado, ou menos de 5 itens (parametrizável). `undefined` se vantajosa. */
export function avisoIdaPoucoVantajosa(args: {
  itens: number;
  totalEstimadoCentavos: number;
  custoIdaCentavos: number;
  limitePct?: number;
  minItens?: number;
}): AvisoIda | undefined {
  const { itens, totalEstimadoCentavos, custoIdaCentavos } = args;
  const motivos: AvisoIda["motivos"] = [];
  if (totalEstimadoCentavos > 0 && custoIdaCentavos >= (totalEstimadoCentavos * (args.limitePct ?? LIMITE_CUSTO_IDA_PCT)) / 100) motivos.push("custo_alto");
  if (itens < (args.minItens ?? MIN_ITENS_IDA)) motivos.push("poucos_itens");
  return motivos.length ? { motivos } : undefined;
}
