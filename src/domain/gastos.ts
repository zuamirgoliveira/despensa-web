// Gastos por mês, deslocamento e inflação pessoal (AGENTS.md 6.6). Centavos.
import { precoNormalizado, type BasePreco } from "./precos";
import type { Categoria, Compra, Produto } from "./types";

export type GastoDoMes = {
  /** AAAA-MM. */
  mes: string;
  /** Total das notas (itens). */
  itensCentavos: number;
  porCategoria: Partial<Record<Categoria, number>>;
  /** Soma dos custos de ida gravados nas compras do mês. */
  deslocamentoCentavos: number;
  /** Itens + deslocamento (RN-10). */
  custoRealCentavos: number;
  compras: number;
};

export const mesDe = (emissao: string): string => emissao.slice(0, 7);

/** Gasto por categoria e com deslocamento em cada mês, do mais recente para o mais antigo. */
export function gastosPorMes(compras: readonly Compra[], produtos: readonly Pick<Produto, "id" | "categoria">[]): GastoDoMes[] {
  const categoria = new Map(produtos.map((p) => [p.id, p.categoria]));
  const meses = new Map<string, GastoDoMes>();
  for (const c of compras) {
    const mes = mesDe(c.emissao);
    const g = meses.get(mes) ?? { mes, itensCentavos: 0, porCategoria: {}, deslocamentoCentavos: 0, custoRealCentavos: 0, compras: 0 };
    for (const i of c.itens) {
      const cat: Categoria = (i.produtoId && categoria.get(i.produtoId)) || "outros";
      g.porCategoria[cat] = (g.porCategoria[cat] ?? 0) + i.valorTotalCentavos;
      g.itensCentavos += i.valorTotalCentavos;
    }
    g.deslocamentoCentavos += c.custoIdaCentavos ?? 0;
    g.compras++;
    meses.set(mes, g);
  }
  return [...meses.values()]
    .map((g) => ({ ...g, custoRealCentavos: g.itensCentavos + g.deslocamentoCentavos }))
    .sort((a, b) => b.mes.localeCompare(a.mes));
}

type PrecoDoMes = { precoMedio: number; gasto: number };

function precosDoMes(compras: readonly Compra[], mes: string): Map<string, PrecoDoMes> {
  const soma = new Map<string, { preco: number; n: number; gasto: number }>();
  for (const c of compras) {
    if (mesDe(c.emissao) !== mes) continue;
    for (const i of c.itens) {
      if (!i.produtoId) continue;
      const chave = `${i.produtoId}|${precoNormalizado(i).base satisfies BasePreco}`;
      const a = soma.get(chave) ?? { preco: 0, n: 0, gasto: 0 };
      a.preco += precoNormalizado(i).centavos;
      a.n++;
      a.gasto += i.valorTotalCentavos;
      soma.set(chave, a);
    }
  }
  return new Map([...soma].map(([k, v]) => [k, { precoMedio: v.preco / v.n, gasto: v.gasto }]));
}

export type InflacaoPessoal = {
  /** Mês base e mês comparado (AAAA-MM). */
  de: string;
  para: string;
  /** Variação do custo da cesta fixa, em %. `undefined` se não há produto comprado nos dois meses. */
  variacaoPct?: number;
  /** Produtos da cesta fixa (comprados nos dois meses, na mesma base de preço). */
  itens: number;
};

/**
 * Inflação pessoal entre dois meses: variação do custo de uma CESTA FIXA, isto é, só os produtos comprados
 * nos dois meses (mesma base de preço normalizado), com as quantidades do mês base mantidas
 * (equivale à média dos reajustes ponderada pelo gasto do mês base). Assim, comprar mais ou menos de um
 * produto não distorce o índice.
 */
export function inflacaoPessoal(compras: readonly Compra[], de: string, para: string): InflacaoPessoal {
  const antes = precosDoMes(compras, de);
  const depois = precosDoMes(compras, para);
  let custoBase = 0;
  let custoNovo = 0;
  let itens = 0;
  for (const [chave, a] of antes) {
    const b = depois.get(chave);
    if (!b || a.precoMedio <= 0) continue;
    custoBase += a.gasto;
    custoNovo += a.gasto * (b.precoMedio / a.precoMedio);
    itens++;
  }
  return { de, para, itens, variacaoPct: custoBase > 0 ? ((custoNovo - custoBase) / custoBase) * 100 : undefined };
}

/** Inflação mês a mês entre meses consecutivos com compras, do mais antigo para o mais novo. */
export function serieDeInflacao(compras: readonly Compra[]): InflacaoPessoal[] {
  const meses = [...new Set(compras.map((c) => mesDe(c.emissao)))].sort();
  return meses.slice(1).map((m, i) => inflacaoPessoal(compras, meses[i], m));
}
