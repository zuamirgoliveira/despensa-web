// Peças da lista de compras: passo da unidade, arredondamento, último preço, regeração e estimativa. Puras.
// A regra de geração (padrão − atual) fica em despensa.ts.
import type { Compra, ItemLista, Produto } from "./types";

export type MotivoItem = "acabou" | "cobertura" | "puxado" | "abaixo";

export type ItemListaSugerido = {
  produtoId: string;
  quantidade: number;
  motivo: MotivoItem;
  urgente: boolean;
  precoEstimadoCentavos?: number;
};

export type ResumoLista = {
  totalEstimadoCentavos: number;
  /** Produtos sem preço conhecido: ficam fora da soma. */
  semPreco: string[];
  avisos: string[];
};

/** Menor quantidade comprável por unidade do produto. */
const PASSO: Record<Produto["unidade"], number> = { kg: 0.1, un: 1, pacote: 1, l: 0.5 };

/** Menor passo de quantidade por unidade (botões +/− da lista). */
export function passoDaUnidade(unidade: Produto["unidade"]): number {
  return PASSO[unidade];
}

const arred = (n: number): number => Math.round(n * 1000) / 1000;

/** Arredonda para cima ao múltiplo de `passo`, sem erro de ponto flutuante. */
export function arredondarParaCima(valor: number, passo: number): number {
  return arred(Math.ceil(Math.round((valor / passo) * 1e6) / 1e6) * passo);
}

/** Último preço unitário (centavos) pago pelo produto, ou undefined se nunca foi comprado. */
export function ultimoPrecoUnitario(produtoId: string, compras: readonly Compra[]): number | undefined {
  let melhor: { emissao: string; preco: number } | undefined;
  for (const c of compras) {
    for (const i of c.itens) {
      if (i.produtoId === produtoId && (!melhor || c.emissao >= melhor.emissao)) {
        melhor = { emissao: c.emissao, preco: i.valorUnitarioCentavos };
      }
    }
  }
  return melhor?.preco;
}

export type MudancasDaRegeracao = {
  adicionar: ItemListaSugerido[];
  atualizar: { id: string; quantidadeSugerida: number; motivo: MotivoItem; urgente: boolean }[];
  remover: string[];
};

/**
 * Regerar a lista preserva as edições manuais: item removido pelo usuário continua removido, quantidade
 * editada permanece, itens avulsos e extras ficam. Só acrescenta o que é novo e atualiza o que o usuário
 * não tocou. Itens automáticos intocados que deixaram de ser sugeridos saem.
 */
export function mesclarRegeracao(sugeridos: readonly ItemListaSugerido[], existentes: readonly ItemLista[]): MudancasDaRegeracao {
  const porProduto = new Map(existentes.filter((i) => i.produtoId).map((i) => [i.produtoId as string, i]));
  const sugeridosIds = new Set(sugeridos.map((s) => s.produtoId));
  const m: MudancasDaRegeracao = { adicionar: [], atualizar: [], remover: [] };

  for (const s of sugeridos) {
    const atual = porProduto.get(s.produtoId);
    if (!atual) m.adicionar.push(s);
    else if (!atual.removido && !atual.quantidadeEditada && atual.status === "pendente") {
      m.atualizar.push({ id: atual.id, quantidadeSugerida: s.quantidade, motivo: s.motivo, urgente: s.urgente });
    }
  }
  for (const i of existentes) {
    const automatico = i.produtoId !== undefined && i.motivo !== undefined && i.motivo !== "manual";
    if (automatico && !i.removido && !i.quantidadeEditada && i.status === "pendente" && !sugeridosIds.has(i.produtoId as string)) {
      m.remover.push(i.id);
    }
  }
  return m;
}


export type EstimativaAtual = { totalCentavos: number; semPreco: string[] };

/**
 * Estimativa de custo da lista como está agora (com as quantidades editadas): quantidade × último preço
 * do produto. Itens removidos ficam fora; itens sem preço (e avulsos) ficam fora da soma e são listados.
 */
export function estimarCusto(itens: readonly ItemLista[], compras: readonly Compra[]): EstimativaAtual {
  let total = 0;
  const semPreco: string[] = [];
  for (const i of itens) {
    if (i.removido) continue;
    const preco = i.produtoId ? ultimoPrecoUnitario(i.produtoId, compras) : undefined;
    if (preco === undefined) semPreco.push(i.id);
    else total += Math.round(i.quantidadeSugerida * preco);
  }
  return { totalCentavos: total, semPreco };
}
