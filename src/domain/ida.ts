// Custo da ida ao mercado (AGENTS.md 6.5). Só dinheiro: o tempo nunca entra na conta. Centavos.
import type { Perfil } from "./types";

/** Custo por km do carro em centavos (fracionário): combustível ÷ consumo + desgaste. */
export function custoPorKmCarro(carro: Perfil["carro"]): number {
  return carro.precoCombustivelCentavos / carro.consumoKmPorLitro + carro.desgasteCentavosPorKm;
}
