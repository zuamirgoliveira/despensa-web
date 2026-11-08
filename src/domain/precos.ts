// Preços normalizados, histórico e variação (AGENTS.md 6.6). Comparar sempre pelo preço normalizado.
import { diasEntre, soData } from "@/lib/datas";
import { extrairEmbalagem } from "./nfce/parser";
import type { Compra } from "./types";

type ItemDaNota = Compra["itens"][number];
type UnidadeNota = ItemDaNota["unidade"];

/** Base de comparação: por kg, por unidade, por litro, por 100 g ou por 100 ml. */
export type BasePreco = "kg" | "un" | "l" | "100g" | "100ml";

const centesimos = (n: number): number => Math.round(n * 100) / 100;

/**
 * Preço normalizado em centavos (pode ter fração de centavo). `KG` → por kg; `L` → por litro; embalagem
 * com tamanho (`PCT 180`, `CAFE 500G`, `LEITE 1L`) → por 100 g ou 100 ml (pacote sem medida = gramas);
 * `CX 12` → por unidade; o resto → por unidade.
 */
export function precoNormalizado(item: Pick<ItemDaNota, "descricao" | "unidade" | "valorUnitarioCentavos"> & Partial<Pick<ItemDaNota, "tamanho">>): {
  centavos: number;
  base: BasePreco;
} {
  const v = item.valorUnitarioCentavos;
  if (item.unidade === "KG") return { centavos: v, base: "kg" };
  if (item.unidade === "L") return { centavos: v, base: "l" };
  // o tamanho confirmado na importação (Coca 2 l mesmo quando a nota diz só "REFRI COCA COLA SEM") vence o da descrição
  if (item.tamanho) {
    const base = item.tamanho.medida === "ml" ? "100ml" : "100g";
    return { centavos: centesimos(v / (item.tamanho.valor / 100)), base };
  }
  const emb = extrairEmbalagem(item.descricao);
  if (emb && emb.tamanho > 0) {
    if (emb.medida === "ml") return { centavos: centesimos(v / (emb.tamanho / 100)), base: "100ml" };
    if (emb.medida === "g" || emb.tipo === "pct") return { centavos: centesimos(v / (emb.tamanho / 100)), base: "100g" };
    return { centavos: centesimos(v / emb.tamanho), base: "un" }; // caixa/bandeja com N unidades
  }
  return { centavos: v, base: "un" };
}

export type PontoPreco = {
  /** YYYY-MM-DDTHH:mm:ss da emissão. */
  emissao: string;
  mercadoId: string;
  /** Preço unitário em centavos, como na nota. */
  precoCentavos: number;
  /** Preço na base de comparação (`base` do histórico). */
  normalizadoCentavos: number;
  quantidade: number;
};

export type HistoricoProduto = {
  produtoId: string;
  unidade: UnidadeNota;
  base: BasePreco;
  /** Do mais antigo para o mais recente. */
  pontos: PontoPreco[];
  ultimo: PontoPreco;
  anterior?: PontoPreco;
  /** Variação do último preço normalizado contra o anterior, em %. */
  variacaoPct?: number;
  /** Menor e maior preço normalizados. */
  menorCentavos: number;
  maiorCentavos: number;
  /** Média dos preços normalizados. */
  mediaCentavos: number;
};

/** Variação percentual; `null` quando o preço anterior é zero. */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

/** Limite abaixo do qual a variação não é mostrada (ruído). */
export const LIMITE_VARIACAO_PCT = 0.5;

/** Média dos preços normalizados; com `janelaDias` e `hoje`, só das compras dessa janela. `undefined` se vazio. */
export function mediaDoUsuario(pontos: readonly PontoPreco[], janela?: { hoje: string; dias: number }): number | undefined {
  const usados = janela ? pontos.filter((p) => diasEntre(soData(p.emissao), janela.hoje) <= janela.dias) : pontos;
  if (!usados.length) return undefined;
  return centesimos(usados.reduce((s, p) => s + p.normalizadoCentavos, 0) / usados.length);
}

/** Históricos de todos os produtos, agrupados por produto e base de comparação. */
export function historicoPorProduto(compras: readonly Compra[]): HistoricoProduto[] {
  const grupos = new Map<string, { produtoId: string; unidade: UnidadeNota; base: BasePreco; pontos: PontoPreco[] }>();
  for (const c of compras) {
    for (const i of c.itens) {
      if (!i.produtoId) continue;
      const n = precoNormalizado(i);
      const chave = `${i.produtoId}|${n.base}`;
      const g = grupos.get(chave) ?? { produtoId: i.produtoId, unidade: i.unidade, base: n.base, pontos: [] };
      g.pontos.push({
        emissao: c.emissao,
        mercadoId: c.mercadoId,
        precoCentavos: i.valorUnitarioCentavos,
        normalizadoCentavos: n.centavos,
        quantidade: i.quantidade,
      });
      grupos.set(chave, g);
    }
  }
  return [...grupos.values()].map((g) => {
    const pontos = [...g.pontos].sort((a, b) => a.emissao.localeCompare(b.emissao));
    const ultimo = pontos[pontos.length - 1];
    const anterior = pontos.length > 1 ? pontos[pontos.length - 2] : undefined;
    const v = anterior ? variacaoPct(ultimo.normalizadoCentavos, anterior.normalizadoCentavos) : null;
    const precos = pontos.map((p) => p.normalizadoCentavos);
    return {
      produtoId: g.produtoId,
      unidade: g.unidade,
      base: g.base,
      pontos,
      ultimo,
      anterior,
      variacaoPct: v ?? undefined,
      menorCentavos: Math.min(...precos),
      maiorCentavos: Math.max(...precos),
      mediaCentavos: mediaDoUsuario(pontos) as number,
    };
  });
}

/** Históricos (um por base de comparação) de um produto. */
export function historicoDoProduto(compras: readonly Compra[], produtoId: string): HistoricoProduto[] {
  return historicoPorProduto(compras).filter((h) => h.produtoId === produtoId);
}

export type AlertaPreco = { tipo: "acima" | "abaixo"; pct: number };

/** Mínimo de compras no histórico para o alerta de preço existir. */
export const MIN_COMPRAS_PARA_ALERTA = 3;

/**
 * Alerta de preço: o último preço normalizado fica mais que `limiarPct`% acima da média das compras
 * anteriores do usuário (e pelo menos 3 compras no histórico). Também avisa, discretamente, quando está
 * mais que o limiar abaixo. "Mais que": exatamente no limiar não alerta.
 */
export function alertaDePreco(h: HistoricoProduto, limiarPct: number): AlertaPreco | undefined {
  if (h.pontos.length < MIN_COMPRAS_PARA_ALERTA) return undefined;
  const media = mediaDoUsuario(h.pontos.slice(0, -1));
  if (!media) return undefined;
  const pct = variacaoPct(h.ultimo.normalizadoCentavos, media);
  if (pct === null) return undefined;
  if (pct > limiarPct) return { tipo: "acima", pct };
  if (-pct > limiarPct) return { tipo: "abaixo", pct: -pct };
  return undefined;
}

/** Alertas por produto (usa o histórico mais recente de cada produto quando há mais de uma base). */
export function alertasPorProduto(compras: readonly Compra[], limiarPct: number): Map<string, AlertaPreco> {
  const maisRecente = new Map<string, HistoricoProduto>();
  for (const h of historicoPorProduto(compras)) {
    const atual = maisRecente.get(h.produtoId);
    if (!atual || h.ultimo.emissao > atual.ultimo.emissao) maisRecente.set(h.produtoId, h);
  }
  const saida = new Map<string, AlertaPreco>();
  for (const [id, h] of maisRecente) {
    const a = alertaDePreco(h, limiarPct);
    if (a) saida.set(id, a);
  }
  return saida;
}
