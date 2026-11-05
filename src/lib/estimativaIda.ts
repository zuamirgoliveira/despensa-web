// Estimativa de distância e tempo da ida: geocodifica o endereço da nota (com variantes) e calcula a rota
// desde a casa. Funções com `Mapas` injetado (testáveis sem rede).
import type { Coordenadas } from "@/domain/types";
import { variantesDeEndereco, type PrecisaoEndereco } from "./endereco";
import { MapasError, type Mapas, type MeioDeRota } from "./mapas";

/** Distância de bicicleta ≈ distância de carro × 1,12 (medido no spike; ver docs/spike-mapas.md). */
export const FATOR_BIKE_SOBRE_CARRO = 1.12;
export const VELOCIDADE_BIKE_KMH = 15;
/** Política do Nominatim: no máximo 1 consulta por segundo. */
export const INTERVALO_NOMINATIM_MS = 1100;

export type PontoDoMercado = { coordenadas: Coordenadas; precisao: PrecisaoEndereco };

/**
 * Tenta as variantes do endereço da mais precisa para a mais aproximada e para na primeira que achar.
 * `null` quando nada é achado. Erros de rede/serviço sobem (o chamador decide o fallback).
 */
export async function geocodificarMercado(
  mapas: Mapas,
  enderecoDaNota: string,
  esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<PontoDoMercado | null> {
  const variantes = variantesDeEndereco(enderecoDaNota);
  for (let i = 0; i < variantes.length; i++) {
    if (i > 0) await esperar(INTERVALO_NOMINATIM_MS);
    const g = await mapas.geocodificar(variantes[i].consulta);
    if (g) return { coordenadas: { lat: g.lat, lng: g.lng }, precisao: variantes[i].precisao };
  }
  return null;
}

const arredondar = (rota: { km: number; min: number }): { km: number; min: number } => ({
  km: Math.round(rota.km * 10) / 10,
  min: Math.round(rota.min),
});

/**
 * Distância e tempo de ida (casa → mercado). Bicicleta: usa o perfil de bike; se o serviço não tiver
 * (ou falhar nele), cai na distância de carro × 1,12 e tempo a 15 km/h. Falhas do carro sobem.
 */
export async function calcularRota(
  mapas: Mapas,
  casa: Coordenadas,
  mercado: Coordenadas,
  meio: MeioDeRota,
): Promise<{ km: number; min: number; estimadaPorFator: boolean }> {
  if (meio === "bike") {
    try {
      return { ...arredondar(await mapas.rota(casa, mercado, "bike")), estimadaPorFator: false };
    } catch (e) {
      if (!(e instanceof MapasError) || e.motivo === "timeout" || e.motivo === "rede") throw e;
      const carro = await mapas.rota(casa, mercado, "carro");
      const km = carro.km * FATOR_BIKE_SOBRE_CARRO;
      return { ...arredondar({ km, min: (km / VELOCIDADE_BIKE_KMH) * 60 }), estimadaPorFator: true };
    }
  }
  return { ...arredondar(await mapas.rota(casa, mercado, "carro")), estimadaPorFator: false };
}
