import { describe, expect, it, vi } from "vitest";
import { calcularRota, FATOR_BIKE_SOBRE_CARRO, geocodificarMercado, INTERVALO_NOMINATIM_MS } from "@/lib/estimativaIda";
import { MapasError, type Mapas } from "@/lib/mapas";

const NOTA = "AVENIDA GOVERNADOR CARLOS DE LIMA CAVALC ,  1245 ,  CASA CAIADA ,  OLINDA ,  PE";
const casa = { lat: -8.0631, lng: -34.8711 };
const mercado = { lat: -7.987, lng: -34.8398 };

function mapasFalsos(achar: (q: string) => boolean, rota?: Mapas["rota"]): Mapas & { consultas: string[] } {
  const consultas: string[] = [];
  return {
    consultas,
    async geocodificar(q) {
      consultas.push(q);
      return achar(q) ? { lat: -7.9847, lng: -34.8383, nome: "x" } : null;
    },
    rota: rota ?? (async () => ({ km: 0, min: 0 })),
  };
}

describe("geocodificarMercado", () => {
  it("para na primeira variante que acha, sem esperar antes da primeira", async () => {
    const m = mapasFalsos(() => true);
    const esperar = vi.fn(async () => undefined);
    const r = await geocodificarMercado(m, NOTA, esperar);
    expect(r).toMatchObject({ precisao: "endereco", coordenadas: { lat: -7.9847, lng: -34.8383 } });
    expect(m.consultas).toHaveLength(1);
    expect(esperar).not.toHaveBeenCalled();
  });

  it("endereço cortado: cai até o bairro (aproximado), esperando 1,1 s entre as consultas", async () => {
    const m = mapasFalsos((q) => q === "Casa Caiada, Olinda, PE, Brasil");
    const esperar = vi.fn(async () => undefined);
    const r = await geocodificarMercado(m, NOTA, esperar);
    expect(r?.precisao).toBe("bairro");
    expect(m.consultas.length).toBeGreaterThan(1);
    expect(esperar).toHaveBeenCalledTimes(m.consultas.length - 1);
    expect(esperar).toHaveBeenCalledWith(INTERVALO_NOMINATIM_MS);
  });

  it("nada achado: null; endereço ilegível: null sem consultar", async () => {
    expect(await geocodificarMercado(mapasFalsos(() => false), NOTA, async () => undefined)).toBeNull();
    const m = mapasFalsos(() => true);
    expect(await geocodificarMercado(m, "???", async () => undefined)).toBeNull();
    expect(m.consultas).toEqual([]);
  });

  it("erro do serviço sobe para o chamador decidir", async () => {
    const m: Mapas = {
      geocodificar: async () => {
        throw new MapasError("timeout");
      },
      rota: async () => ({ km: 0, min: 0 }),
    };
    await expect(geocodificarMercado(m, NOTA, async () => undefined)).rejects.toMatchObject({ motivo: "timeout" });
  });
});

describe("calcularRota", () => {
  const carro = { km: 10.7033, min: 12.02 };
  const bike = { km: 12.0096, min: 50.52 };
  const mapas = (rota: Mapas["rota"]): Mapas => ({ geocodificar: async () => null, rota });

  it("carro: arredonda km a 0,1 e minutos ao inteiro", async () => {
    expect(await calcularRota(mapas(async () => carro), casa, mercado, "carro")).toEqual({ km: 10.7, min: 12, estimadaPorFator: false });
  });

  it("bike usa o perfil de bicicleta do serviço", async () => {
    const r = await calcularRota(mapas(async (_a, _b, meio) => (meio === "bike" ? bike : carro)), casa, mercado, "bike");
    expect(r).toEqual({ km: 12, min: 51, estimadaPorFator: false });
  });

  it("bike sem perfil no serviço: distância de carro × 1,12 e tempo a 15 km/h", async () => {
    const r = await calcularRota(
      mapas(async (_a, _b, meio) => {
        if (meio === "bike") throw new MapasError("sem_rota");
        return carro;
      }),
      casa,
      mercado,
      "bike",
    );
    expect(r.estimadaPorFator).toBe(true);
    expect(r.km).toBe(Math.round(carro.km * FATOR_BIKE_SOBRE_CARRO * 10) / 10); // 12,0
    expect(r.min).toBe(Math.round(((carro.km * FATOR_BIKE_SOBRE_CARRO) / 15) * 60)); // 48
  });

  it("falha de rede ou timeout na bike não cai no fator: sobe o erro", async () => {
    for (const motivo of ["rede", "timeout"] as const) {
      const m = mapas(async () => {
        throw new MapasError(motivo);
      });
      await expect(calcularRota(m, casa, mercado, "bike")).rejects.toMatchObject({ motivo });
    }
  });

  it("falha do carro sobe", async () => {
    const m = mapas(async () => {
      throw new MapasError("http");
    });
    await expect(calcularRota(m, casa, mercado, "carro")).rejects.toMatchObject({ motivo: "http" });
  });
});
