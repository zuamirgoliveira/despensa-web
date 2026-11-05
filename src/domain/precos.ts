import type { Compra } from "./types";

type UnidadeNota = Compra["itens"][number]["unidade"];

export type PontoPreco = {
  /** YYYY-MM-DDTHH:mm:ss da emissão. */
  emissao: string;
  mercadoId: string;
  /** Preço unitário em centavos, como na nota (por kg, unidade, litro ou pacote). */
  precoCentavos: number;
  quantidade: number;
};

export type HistoricoProduto = {
  produtoId: string;
  unidade: UnidadeNota;
  /** Do mais antigo para o mais recente. */
  pontos: PontoPreco[];
  ultimo: PontoPreco;
  anterior?: PontoPreco;
  /** Variação do último preço contra o anterior, em %. */
  variacaoPct?: number;
  menorCentavos: number;
  maiorCentavos: number;
};

/** Variação percentual; `null` quando o preço anterior é zero. */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

/** Limite abaixo do qual a variação não é mostrada (ruído). */
export const LIMITE_VARIACAO_PCT = 0.5;

/** Histórico de preço por produto e unidade (versão simples; a normalizada vem na C-31). */
export function historicoPorProduto(compras: readonly Compra[]): HistoricoProduto[] {
  const grupos = new Map<string, { produtoId: string; unidade: UnidadeNota; pontos: PontoPreco[] }>();
  for (const c of compras) {
    for (const i of c.itens) {
      if (!i.produtoId) continue;
      const chave = `${i.produtoId}|${i.unidade}`;
      const g = grupos.get(chave) ?? { produtoId: i.produtoId, unidade: i.unidade, pontos: [] };
      g.pontos.push({ emissao: c.emissao, mercadoId: c.mercadoId, precoCentavos: i.valorUnitarioCentavos, quantidade: i.quantidade });
      grupos.set(chave, g);
    }
  }
  return [...grupos.values()].map((g) => {
    const pontos = [...g.pontos].sort((a, b) => a.emissao.localeCompare(b.emissao));
    const ultimo = pontos[pontos.length - 1];
    const anterior = pontos.length > 1 ? pontos[pontos.length - 2] : undefined;
    const v = anterior ? variacaoPct(ultimo.precoCentavos, anterior.precoCentavos) : null;
    const precos = pontos.map((p) => p.precoCentavos);
    return {
      produtoId: g.produtoId,
      unidade: g.unidade,
      pontos,
      ultimo,
      anterior,
      variacaoPct: v ?? undefined,
      menorCentavos: Math.min(...precos),
      maiorCentavos: Math.max(...precos),
    };
  });
}
