// Valores iniciais aplicados UMA vez, na primeira abertura do app (quando a casa padrão é criada).
// São os padrões assumidos (AGENTS.md 6.8). Quando docs/parametros-iniciais.md (Z-07) for preenchido,
// transcreva os valores para cá; todos continuam editáveis em Ajustes.
import type { AgendaIda } from "@/domain/types";

export const SEED = {
  agendas: [
    { tipo: "feira_mensal", diaDoMes: 5 },
    { tipo: "mercado_semanal", diaDaSemana: 6 }, // sábado
    { tipo: "hortifruti_semanal", diaDaSemana: 3 }, // quarta
  ],
} as const;

export function agendasIniciais(casaId: string, gerarId: () => string): AgendaIda[] {
  return SEED.agendas.map((a) => ({ id: gerarId(), casaId, ...a }));
}
