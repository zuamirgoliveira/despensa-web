// Dados da tela Início ("Hoje"): próxima ida, quantos produtos vencem nela e lembretes.
import { dataRecife, diasEntre } from "@/lib/datas";
import { proximaIdaDoTipo, type Ida } from "./agenda";
import { gerarLista, type EntradaLista } from "./lista";
import type { AgendaIda, Compra, Lista, Mercado, TipoIda } from "./types";

/** Em empate de data, a feira vem antes (é a ida mais pesada). */
const ORDEM_EMPATE: TipoIda[] = ["feira_mensal", "mercado_semanal", "hortifruti_semanal"];

export type ProximaIda = Ida & { diasAte: number };

/** A próxima ida da agenda, de qualquer tipo (hoje conta). `undefined` sem nenhuma agenda. */
export function proximaIdaGeral(agendas: readonly AgendaIda[], hoje: string): ProximaIda | undefined {
  const idas = ORDEM_EMPATE.flatMap((t) => {
    const i = proximaIdaDoTipo(agendas, t, hoje);
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
  proxima?: ProximaIda;
  /** Itens que a lista da próxima ida teria agora. */
  quantosVencem: number;
  notasPendentes: Lista[];
  estimativasPendentes: Mercado[];
  /** Nenhuma nota importada ainda. */
  semNotas: boolean;
};

export function resumirDia(
  e: Omit<EntradaLista, "tipo"> & { listas: readonly Lista[]; mercados: readonly Mercado[] },
): ResumoDoDia {
  const proxima = proximaIdaGeral(e.agendas, e.hoje);
  const lista = proxima && gerarLista({ ...e, tipo: proxima.tipo });
  return {
    proxima,
    quantosVencem: lista?.itens.length ?? 0,
    notasPendentes: listasComNotaPendente(e.listas, e.hoje),
    estimativasPendentes: mercadosComEstimativaPendente(e.mercados, e.compras),
    semNotas: e.compras.length === 0,
  };
}
