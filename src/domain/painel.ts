// Painel do objetivo (M10): métricas mensais para acompanhar a redução de idas. Funções puras.
import { dataRecife } from "@/lib/datas";
import { estatisticasDeIdas } from "./ida";
import { mesDe } from "./gastos";
import { reconciliar } from "./reconciliacao";
import type { Compra, ItemLista, Lista, Mercado, RegistroConferencia, TipoIda } from "./types";

export type MetricasDoMes = {
  mes: string;
  idas: number;
  idasPorTipo: Partial<Record<TipoIda | "sem_lista", number>>;
  /** Itens fora da lista em ida de reposição. */
  emergencias: number;
  /** "Acabou" marcado na conferência (que não estava acabado) + compras de emergência. */
  rupturas: number;
  /** Média de segundos das conferências concluídas no mês. `undefined` sem conferências. */
  tempoMedioConferenciaSegundos?: number;
  /** % de itens das notas que já tinham apelido no catálogo. `undefined` sem dados. */
  itensCasadosPct?: number;
  deslocamentoCentavos: number;
  /** Minutos de deslocamento (ida e volta). Só informação: nunca vira dinheiro. */
  minutosEmIdas: number;
};

export type EntradaPainel = {
  compras: readonly Compra[];
  listas: readonly Lista[];
  itensLista: readonly ItemLista[];
  mercados: readonly Pick<Mercado, "id" | "tempoMinIda">[];
  conferencias: readonly RegistroConferencia[];
};

export function metricasDoMes(e: EntradaPainel, mes: string): MetricasDoMes {
  const [ano, m] = mes.split("-").map(Number);
  const doMes = e.compras.filter((c) => mesDe(c.emissao) === mes);
  const listaPorId = new Map(e.listas.map((l) => [l.id, l]));

  const idasPorTipo: MetricasDoMes["idasPorTipo"] = {};
  let emergencias = 0;
  for (const c of doMes) {
    const lista = c.listaId ? listaPorId.get(c.listaId) : undefined;
    const tipo = lista?.tipoIda ?? "sem_lista";
    idasPorTipo[tipo] = (idasPorTipo[tipo] ?? 0) + 1;
    if (lista) {
      const itens = e.itensLista.filter((i) => i.listaId === lista.id);
      emergencias += reconciliar(lista, itens, c.itens).emergencias.length;
    }
  }

  const confs = e.conferencias.filter((c) => mesDe(dataRecife(c.iniciadaEm)) === mes);
  const rupturasConferencia = confs.reduce((s, c) => s + c.rupturas, 0);
  const comCasados = doMes.filter((c) => c.itensCasados !== undefined);
  const totalItens = comCasados.reduce((s, c) => s + c.itens.length, 0);
  const casados = comCasados.reduce((s, c) => s + (c.itensCasados ?? 0), 0);
  const est = estatisticasDeIdas(e.compras, e.mercados, ano, m);

  return {
    mes,
    idas: doMes.length,
    idasPorTipo,
    emergencias,
    rupturas: rupturasConferencia + emergencias,
    tempoMedioConferenciaSegundos: confs.length ? Math.round(confs.reduce((s, c) => s + c.duracaoSegundos, 0) / confs.length) : undefined,
    itensCasadosPct: totalItens > 0 ? (casados / totalItens) * 100 : undefined,
    deslocamentoCentavos: est.custoTotalCentavos,
    minutosEmIdas: est.minutos,
  };
}

export type Tendencia = "melhorou" | "piorou" | "igual" | "sem_dados";

/** Compara dois valores de uma métrica. `melhorQuando`: menor (idas, emergências…) ou maior (itens casados). */
export function tendencia(atual: number | undefined, anterior: number | undefined, melhorQuando: "menor" | "maior"): Tendencia {
  if (atual === undefined || anterior === undefined) return "sem_dados";
  if (atual === anterior) return "igual";
  return (atual < anterior) === (melhorQuando === "menor") ? "melhorou" : "piorou";
}

/** Mês anterior no formato AAAA-MM. */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/** O painel só faz sentido com pelo menos uma compra: sem isso mostra orientação, não zeros enganosos. */
export function painelTemDados(e: Pick<EntradaPainel, "compras">): boolean {
  return e.compras.length > 0;
}
