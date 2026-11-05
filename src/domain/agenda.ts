// Agenda das idas ao mercado (AGENTS.md 6.2). Datas AAAA-MM-DD, sem hora nem fuso.
import { adicionarDias, diaDaSemana, diasEntre, montarData, ultimoDiaDoMes } from "@/lib/datas";
import type { AgendaIda, Produto, TipoIda } from "./types";

export { diasEntre };

export type Ida = { tipo: TipoIda; data: string; agendaId: string };

type AgendaMinima = Pick<AgendaIda, "tipo" | "diaDoMes" | "diaDaSemana">;

/**
 * Próxima data da agenda a partir de `aPartirDe`. Semanal: próximo dia da semana configurado.
 * Mensal: próxima data com o dia do mês, ajustada para o último dia quando o mês é mais curto
 * (31 em abril → 30; 30 em fevereiro → 28 ou 29).
 */
export function proximaOcorrencia(agenda: AgendaMinima, aPartirDe: string, incluirHoje = true): string {
  const inicio = incluirHoje ? aPartirDe : adicionarDias(aPartirDe, 1);
  if (agenda.tipo === "feira_mensal") {
    const dia = agenda.diaDoMes;
    if (dia === undefined) throw new Error("Agenda mensal sem dia do mês.");
    const [a, m] = inicio.split("-").map(Number);
    const doMes = (ano: number, mes: number): string => montarData(ano, mes, Math.min(dia, ultimoDiaDoMes(ano, mes)));
    const esteMes = doMes(a, m);
    if (esteMes >= inicio) return esteMes;
    return m === 12 ? doMes(a + 1, 1) : doMes(a, m + 1); // sempre posterior a `inicio`
  }
  const alvo = agenda.diaDaSemana;
  if (alvo === undefined) throw new Error("Agenda semanal sem dia da semana.");
  return adicionarDias(inicio, (alvo - diaDaSemana(inicio) + 7) % 7);
}

/** Todas as ocorrências entre duas datas, inclusive nas pontas. */
export function ocorrenciasEntre(agenda: AgendaMinima, de: string, ate: string): string[] {
  const lista: string[] = [];
  let atual = proximaOcorrencia(agenda, de, true);
  while (atual <= ate) {
    lista.push(atual);
    atual = proximaOcorrencia(agenda, atual, false);
  }
  return lista;
}

/** Próxima ida do tipo (a partir de `hoje`, inclusive). `undefined` se o tipo não tem agenda. */
export function proximaIdaDoTipo(agendas: readonly AgendaIda[], tipo: TipoIda, hoje: string): Ida | undefined {
  const a = agendas.find((x) => x.tipo === tipo);
  return a ? { tipo, data: proximaOcorrencia(a, hoje, true), agendaId: a.id } : undefined;
}

/** A ocorrência do tipo imediatamente depois de `data` (estritamente posterior). */
export function idaSeguinte(agendas: readonly AgendaIda[], tipo: TipoIda, data: string): Ida | undefined {
  const a = agendas.find((x) => x.tipo === tipo);
  return a ? { tipo, data: proximaOcorrencia(a, data, false), agendaId: a.id } : undefined;
}

/**
 * Tipos de ida para onde o produto pode ser "puxado" quando o estoque acaba antes da ida padrão:
 * feira mensal e mercearia → mercado semanal; hortifruti fica no hortifruti semanal.
 */
export function tiposCompativeis(produto: Pick<Produto, "tipoIda" | "categoria">): TipoIda[] {
  if (produto.tipoIda === "feira_mensal") {
    return produto.categoria === "hortifruti" ? ["hortifruti_semanal"] : ["mercado_semanal"];
  }
  return [produto.tipoIda];
}
