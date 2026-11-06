// Dados da tela Início ("Hoje"): próxima ida, quantos produtos vencem nela e lembretes.
import { dataRecife, diasEntre, soData } from "@/lib/datas";
import { idaSeguinte, proximaIdaDoTipo, type Ida } from "./agenda";
import { gerarListaDaCasa } from "./despensa";
import type { AgendaIda, Compra, Estoque, Lista, Mercado, Produto, TipoIda } from "./types";

/** Em empate de data, a feira vem antes (é a ida mais pesada). */
const ORDEM_EMPATE: TipoIda[] = ["feira_mensal", "mercado_semanal", "hortifruti_semanal"];

export type ProximaIda = Ida & { diasAte: number };

/**
 * A próxima ida da agenda, de qualquer tipo (hoje conta). `undefined` sem nenhuma agenda.
 * Com `compras`, uma ida cuja data já tem compra importada é dada como feita e passa para a seguinte do mesmo tipo.
 */
export function proximaIdaGeral(agendas: readonly AgendaIda[], hoje: string, compras: readonly Compra[] = []): ProximaIda | undefined {
  const datasComprou = new Set(compras.map((c) => soData(c.emissao)));
  const idas = ORDEM_EMPATE.flatMap((t) => {
    let i = proximaIdaDoTipo(agendas, t, hoje);
    if (i && datasComprou.has(i.data)) i = idaSeguinte(agendas, t, i.data);
    return i ? [i] : [];
  });
  const primeira = idas.sort((a, b) => a.data.localeCompare(b.data))[0];
  return primeira && { ...primeira, diasAte: diasEntre(hoje, primeira.data) };
}

/** Quantos dias uma lista em compra pode ficar aberta antes de lembrar de importar a nota. */
export const DIAS_PARA_LEMBRAR_NOTA = 1;

/** Listas `em_compra` abertas há mais de 1 dia: falta importar a nota. */
export function listasComNotaPendente(listas: readonly Lista[], hoje: string): Lista[] {
  return listas.filter((l) => l.status === "em_compra" && diasEntre(dataRecife(l.criadaEm), hoje) > DIAS_PARA_LEMBRAR_NOTA);
}

/** Mercados com compras ainda sem custo de ida (estimativa pendente). */
export function mercadosComEstimativaPendente(mercados: readonly Mercado[], compras: readonly Compra[]): Mercado[] {
  const pendentes = new Set(compras.filter((c) => c.custoIdaCentavos === undefined).map((c) => c.mercadoId));
  return mercados.filter((m) => pendentes.has(m.id));
}

export type ResumoDoDia = {
  /** Itens ativos da despensa. */
  itens: number;
  /** Recorrentes que iriam para a lista agora (zerados ou abaixo do padrão). */
  faltando: number;
  /** Desses, os zerados. */
  zerados: number;
  /** Eventuais (não recorrentes) que acabaram: não vão para a lista sozinhos. */
  eventuaisZerados: number;
  proxima?: ProximaIda;
  notasPendentes: Lista[];
  estimativasPendentes: Mercado[];
  /** Despensa vazia e nenhuma nota importada: tela de boas-vindas. */
  semNada: boolean;
};

export function resumirDia(e: {
  hoje: string;
  produtos: readonly Produto[];
  estoques: readonly Estoque[];
  compras: readonly Compra[];
  agendas: readonly AgendaIda[];
  listas: readonly Lista[];
  mercados: readonly Mercado[];
}): ResumoDoDia {
  const ativos = e.produtos.filter((p) => p.ativo);
  const lista = gerarListaDaCasa({ produtos: e.produtos, estoques: e.estoques, compras: e.compras });
  return {
    itens: ativos.length,
    faltando: lista.itens.length,
    zerados: lista.itens.filter((i) => i.motivo === "acabou").length,
    eventuaisZerados: lista.naoRecorrentesZerados.length,
    proxima: proximaIdaGeral(e.agendas, e.hoje, e.compras),
    notasPendentes: listasComNotaPendente(e.listas, e.hoje),
    estimativasPendentes: mercadosComEstimativaPendente(e.mercados, e.compras),
    semNada: ativos.length === 0 && e.compras.length === 0,
  };
}
