// Formulários de Ajustes: converte o texto digitado (vírgula decimal, reais) e valida com os schemas.
import type { AgendaIda, Perfil, TipoIda } from "@/domain/types";
import { agendaIdaSchema, perfilSchema } from "@/schemas";

const numero = (s: string): number => (s.trim() === "" ? Number.NaN : Number(s.trim().replace(/\./g, "").replace(",", ".")));
const reais = (centavos: number): string => (centavos / 100).toFixed(2).replace(".", ",");
const emCentavos = (s: string): number => Math.round(numero(s) * 100);

export type ValoresPerfil = {
  folgaDias: string;
  limiarAlertaPrecoPct: string;
  economiaMinimaDivisao: string;
  consumoKmPorLitro: string;
  precoCombustivel: string;
  desgastePorKm: string;
  bikePorKm: string;
};
export type CampoPerfil = keyof ValoresPerfil;
export type ResultadoPerfil = { ok: true; perfil: Perfil } | { ok: false; erros: Partial<Record<CampoPerfil, string>> };

export function valoresDoPerfil(p: Perfil): ValoresPerfil {
  return {
    folgaDias: String(p.folgaDias),
    limiarAlertaPrecoPct: String(p.limiarAlertaPrecoPct).replace(".", ","),
    economiaMinimaDivisao: reais(p.economiaMinimaDivisaoCentavos),
    consumoKmPorLitro: String(p.carro.consumoKmPorLitro).replace(".", ","),
    precoCombustivel: reais(p.carro.precoCombustivelCentavos),
    desgastePorKm: reais(p.carro.desgasteCentavosPorKm),
    bikePorKm: reais(p.bikeCentavosPorKm),
  };
}

const MSG_PERFIL: Record<CampoPerfil, string> = {
  folgaDias: "Informe a folga em dias (0 a 30).",
  limiarAlertaPrecoPct: "Informe uma porcentagem maior ou igual a zero.",
  economiaMinimaDivisao: "Informe um valor em reais maior ou igual a zero.",
  consumoKmPorLitro: "Informe os km por litro (maior que zero).",
  precoCombustivel: "Informe o preço do litro em reais.",
  desgastePorKm: "Informe o desgaste por km em reais.",
  bikePorKm: "Informe o custo por km em reais.",
};

const CAMINHO_PERFIL: Record<string, CampoPerfil> = {
  folgaDias: "folgaDias",
  limiarAlertaPrecoPct: "limiarAlertaPrecoPct",
  economiaMinimaDivisaoCentavos: "economiaMinimaDivisao",
  consumoKmPorLitro: "consumoKmPorLitro",
  precoCombustivelCentavos: "precoCombustivel",
  desgasteCentavosPorKm: "desgastePorKm",
  bikeCentavosPorKm: "bikePorKm",
};

export function validarPerfil(original: Perfil, v: ValoresPerfil): ResultadoPerfil {
  const candidato = {
    ...original,
    folgaDias: numero(v.folgaDias),
    limiarAlertaPrecoPct: numero(v.limiarAlertaPrecoPct),
    economiaMinimaDivisaoCentavos: emCentavos(v.economiaMinimaDivisao),
    carro: {
      consumoKmPorLitro: numero(v.consumoKmPorLitro),
      precoCombustivelCentavos: emCentavos(v.precoCombustivel),
      desgasteCentavosPorKm: emCentavos(v.desgastePorKm),
    },
    bikeCentavosPorKm: numero(v.bikePorKm) * 100,
  };
  const r = perfilSchema.safeParse(candidato);
  if (r.success) return { ok: true, perfil: r.data };
  const erros: Partial<Record<CampoPerfil, string>> = {};
  for (const issue of r.error.issues) {
    const chave = String(issue.path[issue.path.length - 1]);
    const campo = CAMINHO_PERFIL[chave];
    if (campo && !erros[campo]) erros[campo] = MSG_PERFIL[campo];
  }
  return { ok: false, erros };
}

export type ValoresAgenda = { dia: string; mercadoId: string };
export type ResultadoAgenda = { ok: true; agenda: AgendaIda } | { ok: false; erro: string };

export function valoresDaAgenda(a: AgendaIda | undefined): ValoresAgenda {
  return { dia: String(a?.diaDoMes ?? a?.diaDaSemana ?? ""), mercadoId: a?.mercadoId ?? "" };
}

export function validarAgenda(tipo: TipoIda, casaId: string, atual: AgendaIda | undefined, v: ValoresAgenda, novoId: () => string): ResultadoAgenda {
  const dia = v.dia === "" ? Number.NaN : Number(v.dia);
  const base = { id: atual?.id ?? novoId(), casaId, tipo, mercadoId: v.mercadoId || undefined };
  const candidato = tipo === "feira_mensal" ? { ...base, diaDoMes: dia } : { ...base, diaDaSemana: dia };
  const r = agendaIdaSchema.safeParse(candidato);
  if (r.success) return { ok: true, agenda: r.data };
  return { ok: false, erro: tipo === "feira_mensal" ? "Escolha o dia do mês (1 a 31)." : "Escolha o dia da semana." };
}
