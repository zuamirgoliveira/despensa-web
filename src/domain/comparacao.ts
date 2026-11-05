// Comparação entre mercados e custo da cesta (AGENTS.md 6.6). Sempre pelo preço normalizado.
import { diasEntre, soData } from "@/lib/datas";
import { precoNormalizado, type BasePreco } from "./precos";
import type { Compra, Produto } from "./types";

export type PrecoNoMercado = {
  mercadoId: string;
  /** Preço normalizado mais recente nesse mercado, dentro da janela. */
  normalizadoCentavos: number;
  /** Preço unitário bruto da nota (para somar a cesta na unidade de compra do produto). */
  precoCentavos: number;
  emissao: string;
};

export type ComparacaoProduto = {
  produtoId: string;
  base: BasePreco;
  /** Do mais barato para o mais caro. */
  mercados: PrecoNoMercado[];
  melhorMercadoId: string;
  /** Mais de um mercado com o mesmo menor preço. */
  empate: boolean;
};

export const JANELA_PADRAO_DIAS = 60;

/**
 * Para cada produto, o preço normalizado MAIS RECENTE em cada mercado dentro da janela (padrão 60 dias)
 * e o mercado mais barato. Preços de bases diferentes não se misturam: vale a base do preço mais recente.
 */
export function melhorMercadoPorProduto(
  compras: readonly Compra[],
  hoje: string,
  janelaDias: number = JANELA_PADRAO_DIAS,
): Map<string, ComparacaoProduto> {
  type Linha = PrecoNoMercado & { base: BasePreco };
  const recentes = new Map<string, Map<string, Linha>>(); // produto → mercado → linha
  for (const c of compras) {
    if (diasEntre(soData(c.emissao), hoje) > janelaDias) continue;
    for (const i of c.itens) {
      if (!i.produtoId) continue;
      const n = precoNormalizado(i);
      const porMercado = recentes.get(i.produtoId) ?? new Map<string, Linha>();
      const atual = porMercado.get(c.mercadoId);
      if (!atual || c.emissao >= atual.emissao) {
        porMercado.set(c.mercadoId, { mercadoId: c.mercadoId, normalizadoCentavos: n.centavos, precoCentavos: i.valorUnitarioCentavos, emissao: c.emissao, base: n.base });
      }
      recentes.set(i.produtoId, porMercado);
    }
  }
  const saida = new Map<string, ComparacaoProduto>();
  for (const [produtoId, porMercado] of recentes) {
    const todas = [...porMercado.values()];
    const base = todas.reduce((a, b) => (b.emissao > a.emissao ? b : a)).base;
    const mercados = todas.filter((l) => l.base === base).sort((a, b) => a.normalizadoCentavos - b.normalizadoCentavos || a.mercadoId.localeCompare(b.mercadoId));
    const melhor = mercados[0];
    saida.set(produtoId, {
      produtoId,
      base,
      mercados: mercados.map((m) => ({ mercadoId: m.mercadoId, normalizadoCentavos: m.normalizadoCentavos, precoCentavos: m.precoCentavos, emissao: m.emissao })),
      melhorMercadoId: melhor.mercadoId,
      empate: mercados.filter((m) => m.normalizadoCentavos === melhor.normalizadoCentavos).length > 1,
    });
  }
  return saida;
}

export type CestaDoMercado = {
  mercadoId: string;
  totalCentavos: number;
  /** Itens da cesta com preço conhecido neste mercado. */
  cobertos: number;
  /** Itens da cesta (produtos ativos com meta). */
  totalItens: number;
};

/**
 * Custo da cesta num mercado: soma de `meta × último preço` dos produtos ativos com meta, só dos que têm
 * preço conhecido ali. Informa a cobertura ("preços de N de M itens"): comparar cestas só faz sentido
 * com a mesma cobertura.
 */
export function custoDaCesta(
  produtos: readonly Pick<Produto, "id" | "meta" | "ativo">[],
  mercadoId: string,
  comparacoes: ReadonlyMap<string, ComparacaoProduto>,
): CestaDoMercado {
  const cesta = produtos.filter((p) => p.ativo && p.meta > 0);
  let total = 0;
  let cobertos = 0;
  for (const p of cesta) {
    const preco = comparacoes.get(p.id)?.mercados.find((m) => m.mercadoId === mercadoId);
    if (!preco) continue;
    total += Math.round(p.meta * preco.precoCentavos);
    cobertos++;
  }
  return { mercadoId, totalCentavos: total, cobertos, totalItens: cesta.length };
}

/** Diferença mínima (em %) entre o melhor e o preço atual para sugerir trocar o mercado preferido. */
export const LIMIAR_SUGESTAO_PREFERIDO_PCT = 10;

export type SugestaoMercado = { mercadoId: string; economiaPct: number };

/**
 * Sugestão (nunca troca sozinha) de mercado preferido: só com preços de pelo menos 2 mercados, quando o
 * melhor é diferente do preferido atual e mais barato por mais que o limiar (padrão 10%). Sem preferido,
 * compara com a média dos outros mercados.
 */
export function sugerirMercadoPreferido(
  produto: Pick<Produto, "id" | "mercadoPreferidoId">,
  comparacoes: ReadonlyMap<string, ComparacaoProduto>,
  limiarPct: number = LIMIAR_SUGESTAO_PREFERIDO_PCT,
): SugestaoMercado | undefined {
  const c = comparacoes.get(produto.id);
  if (!c || c.mercados.length < 2 || c.empate || c.melhorMercadoId === produto.mercadoPreferidoId) return undefined;
  const melhor = c.mercados[0].normalizadoCentavos;
  const referencia = c.mercados.find((m) => m.mercadoId === produto.mercadoPreferidoId)?.normalizadoCentavos
    ?? c.mercados.slice(1).reduce((s, m) => s + m.normalizadoCentavos, 0) / (c.mercados.length - 1);
  if (referencia <= 0) return undefined;
  const economiaPct = ((referencia - melhor) / referencia) * 100;
  return economiaPct > limiarPct ? { mercadoId: c.melhorMercadoId, economiaPct } : undefined;
}
