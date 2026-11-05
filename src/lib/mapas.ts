// Cliente do serviço de mapas, chamado direto do navegador (D24: sem rota de API própria).
// Nominatim (geocodificação) + OSRM do FOSSGIS (rotas de carro e bicicleta). Sem chave. Ver docs/spike-mapas.md.
// Privacidade: ao geocodificador vai só o texto do endereço do MERCADO; às rotas, só coordenadas.
import { z } from "zod";
import type { Coordenadas } from "@/domain/types";

export const ORIGEM_NOMINATIM = "https://nominatim.openstreetmap.org";
export const ORIGEM_ROTAS = "https://routing.openstreetmap.de";

export type MeioDeRota = "carro" | "bike";

export type Geocodificacao = { lat: number; lng: number; nome: string };
export type RotaCalculada = { km: number; min: number };

export interface Mapas {
  /** Primeiro resultado da consulta ou `null` se nada foi achado. */
  geocodificar(consulta: string): Promise<Geocodificacao | null>;
  rota(origem: Coordenadas, destino: Coordenadas, meio: MeioDeRota): Promise<RotaCalculada>;
}

export type MotivoErroMapas = "timeout" | "rede" | "http" | "resposta_invalida" | "sem_rota";

export class MapasError extends Error {
  constructor(public readonly motivo: MotivoErroMapas, detalhe?: string) {
    super(detalhe ?? motivo);
    this.name = "MapasError";
  }
}

const respostaGeocodificacao = z.array(z.object({ lat: z.string(), lon: z.string(), display_name: z.string() }));
const respostaRota = z.object({
  code: z.string(),
  routes: z.array(z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative() })).optional(),
});

const PERFIL: Record<MeioDeRota, string> = { carro: "routed-car", bike: "routed-bike" };

export type OpcoesMapas = {
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/** Cliente real. `fetch` e `timeoutMs` são injetáveis para testes (que nunca chamam o serviço de verdade). */
export function criarMapas({ fetch: f = (...a) => fetch(...a), timeoutMs = 10_000 }: OpcoesMapas = {}): Mapas {
  async function pegar(url: string): Promise<unknown> {
    let r: Response;
    try {
      r = await f(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
    } catch (e) {
      const nome = e instanceof Error ? e.name : "";
      throw new MapasError(nome === "TimeoutError" || nome === "AbortError" ? "timeout" : "rede");
    }
    if (!r.ok) throw new MapasError("http", `HTTP ${r.status}`);
    try {
      return await r.json();
    } catch {
      throw new MapasError("resposta_invalida");
    }
  }

  return {
    async geocodificar(consulta) {
      const q = new URLSearchParams({ q: consulta, format: "jsonv2", limit: "1", countrycodes: "br" });
      const r = respostaGeocodificacao.safeParse(await pegar(`${ORIGEM_NOMINATIM}/search?${q}`));
      if (!r.success) throw new MapasError("resposta_invalida");
      const [achado] = r.data;
      if (!achado) return null;
      const lat = Number(achado.lat);
      const lng = Number(achado.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new MapasError("resposta_invalida");
      return { lat, lng, nome: achado.display_name };
    },

    async rota(origem, destino, meio) {
      const coords = `${origem.lng},${origem.lat};${destino.lng},${destino.lat}`;
      const r = respostaRota.safeParse(await pegar(`${ORIGEM_ROTAS}/${PERFIL[meio]}/route/v1/driving/${coords}?overview=false`));
      if (!r.success) throw new MapasError("resposta_invalida");
      const rota = r.data.routes?.[0];
      if (r.data.code !== "Ok" || !rota) throw new MapasError("sem_rota", r.data.code);
      return { km: rota.distance / 1000, min: rota.duration / 60 };
    },
  };
}
