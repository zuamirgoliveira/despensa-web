// Custo da ida ao mercado (AGENTS.md 6.5). Só dinheiro: o tempo nunca entra na conta. Centavos.
import type { Compra, Mercado, Perfil } from "./types";

/** Custo por km do carro em centavos (fracionário): combustível ÷ consumo + desgaste. */
export function custoPorKmCarro(carro: Perfil["carro"]): number {
  return carro.precoCombustivelCentavos / carro.consumoKmPorLitro + carro.desgasteCentavosPorKm;
}

export type MeioDeTransporte = "carro" | "bike_eletrica" | "a_pe";

/**
 * Custo financeiro da ida e volta, em centavos (arredondado ao centavo). Só dinheiro: o tempo não
 * entra na conta. Carro: km × (combustível ÷ consumo + desgaste) + custo fixo (ex.: estacionamento).
 * Bike elétrica: km × custo por km (sem custo fixo).
 */
export function custoIda(args: {
  meio: MeioDeTransporte;
  /** Distância da ida e volta, em km. */
  kmIdaVolta: number;
  perfil: Pick<Perfil, "carro" | "bikeCentavosPorKm">;
  custoFixoCentavos?: number;
}): number {
  const { meio, kmIdaVolta, perfil } = args;
  if (meio === "a_pe") return 0;
  if (meio === "bike_eletrica") return Math.round(kmIdaVolta * perfil.bikeCentavosPorKm);
  return Math.round(kmIdaVolta * custoPorKmCarro(perfil.carro) + (args.custoFixoCentavos ?? 0));
}

/**
 * Custo da ida de um mercado. `distanciaKm` do mercado é **de ida** (casa → mercado); o custo usa
 * ida e volta (×2). `undefined` enquanto a distância não é conhecida.
 */
export function custoIdaDoMercado(
  mercado: Pick<Mercado, "transporte" | "distanciaKm" | "custoFixoIdaCentavos">,
  perfil: Pick<Perfil, "carro" | "bikeCentavosPorKm">,
): number | undefined {
  if (mercado.distanciaKm === undefined) return undefined;
  return custoIda({ meio: mercado.transporte, kmIdaVolta: mercado.distanciaKm * 2, perfil, custoFixoCentavos: mercado.custoFixoIdaCentavos });
}

/** Custo real da compra: itens + custo da ida (RN-10). */
export function custoRealCompra(totalItensCentavos: number, custoIdaCentavos: number): number {
  return totalItensCentavos + custoIdaCentavos;
}

export type EstatisticaDeIdas = {
  /** Número de idas (compras) no mês. */
  idas: number;
  /** Minutos totais de deslocamento (ida e volta). Só informação: nunca vira dinheiro. */
  minutos: number;
  /** Idas do mês cujo mercado ainda não tem tempo estimado. */
  semEstimativa: number;
  /** Soma dos custos de ida gravados nas compras do mês. */
  custoTotalCentavos: number;
};

/** Idas e tempo gasto em deslocamento num mês (`mes` de 1 a 12), como informação (RF-807). */
export function estatisticasDeIdas(
  compras: readonly Pick<Compra, "emissao" | "mercadoId" | "custoIdaCentavos">[],
  mercados: readonly Pick<Mercado, "id" | "tempoMinIda">[],
  ano: number,
  mes: number,
): EstatisticaDeIdas {
  const prefixo = `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
  const tempo = new Map(mercados.map((m) => [m.id, m.tempoMinIda]));
  const e: EstatisticaDeIdas = { idas: 0, minutos: 0, semEstimativa: 0, custoTotalCentavos: 0 };
  for (const c of compras) {
    if (!c.emissao.startsWith(prefixo)) continue;
    e.idas++;
    const t = tempo.get(c.mercadoId);
    if (t === undefined) e.semEstimativa++;
    else e.minutos += t * 2;
    e.custoTotalCentavos += c.custoIdaCentavos ?? 0;
  }
  return e;
}
