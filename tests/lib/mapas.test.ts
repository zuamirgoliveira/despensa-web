import { describe, expect, it, vi } from "vitest";
import { criarMapas, MapasError, ORIGEM_NOMINATIM, ORIGEM_ROTAS } from "@/lib/mapas";

const resposta = (corpo: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(corpo), { status: 200, ...init });
const mapasCom = (impl: typeof fetch, timeoutMs?: number) => criarMapas({ fetch: impl, timeoutMs });

describe("geocodificar", () => {
  it("devolve o primeiro resultado e monta a URL só com o endereço do mercado", async () => {
    const f = vi.fn(async () => resposta([{ lat: "-7.9847", lon: "-34.8383", display_name: "Casa Caiada, Olinda" }]));
    const g = await mapasCom(f as unknown as typeof fetch).geocodificar("Casa Caiada, Olinda, PE, Brasil");
    expect(g).toEqual({ lat: -7.9847, lng: -34.8383, nome: "Casa Caiada, Olinda" });
    const url = new URL((f.mock.calls as unknown as [string][])[0][0]);
    expect(url.origin).toBe(ORIGEM_NOMINATIM);
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("q")).toBe("Casa Caiada, Olinda, PE, Brasil");
    expect(url.searchParams.get("countrycodes")).toBe("br");
    expect([...url.searchParams.keys()].sort()).toEqual(["countrycodes", "format", "limit", "q"]);
  });

  it("nenhum resultado devolve null", async () => {
    expect(await mapasCom((async () => resposta([])) as unknown as typeof fetch).geocodificar("x")).toBeNull();
  });

  it.each([
    ["resposta fora do formato", () => resposta({ erro: true }), "resposta_invalida"],
    ["coordenada não numérica", () => resposta([{ lat: "abc", lon: "1", display_name: "x" }]), "resposta_invalida"],
    ["JSON inválido", () => new Response("<html>", { status: 200 }), "resposta_invalida"],
    ["HTTP 429", () => new Response("", { status: 429 }), "http"],
    ["HTTP 500", () => new Response("", { status: 500 }), "http"],
  ])("%s → %s", async (_nome, fabrica, motivo) => {
    const f = (async () => fabrica()) as unknown as typeof fetch;
    await expect(mapasCom(f).geocodificar("x")).rejects.toMatchObject({ name: "MapasError", motivo });
  });

  it("falha de rede (offline)", async () => {
    const f = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(mapasCom(f).geocodificar("x")).rejects.toMatchObject({ motivo: "rede" });
  });

  it("timeout", async () => {
    const f = ((_u: string, init: RequestInit) =>
      new Promise((_, rejeitar) => {
        init.signal?.addEventListener("abort", () => rejeitar(init.signal?.reason));
      })) as unknown as typeof fetch;
    await expect(mapasCom(f, 20).geocodificar("x")).rejects.toMatchObject({ motivo: "timeout" });
  });
});

describe("rota", () => {
  const ok = { code: "Ok", routes: [{ distance: 10703.3, duration: 721.2 }] };

  it("converte metros e segundos; usa o perfil certo e manda só coordenadas", async () => {
    const f = vi.fn(async () => resposta(ok));
    const mapas = mapasCom(f as unknown as typeof fetch);
    const r = await mapas.rota({ lat: -8.0631, lng: -34.8711 }, { lat: -7.987, lng: -34.8398 }, "carro");
    expect(r.km).toBeCloseTo(10.7033);
    expect(r.min).toBeCloseTo(12.02);
    await mapas.rota({ lat: -8.0631, lng: -34.8711 }, { lat: -7.987, lng: -34.8398 }, "bike");
    const urls = (f.mock.calls as unknown as [string][]).map((c) => c[0]);
    expect(urls[0]).toBe(`${ORIGEM_ROTAS}/routed-car/route/v1/driving/-34.8711,-8.0631;-34.8398,-7.987?overview=false`);
    expect(urls[1]).toContain("/routed-bike/");
  });

  it.each([
    ["sem rota", { code: "NoRoute" }, "sem_rota"],
    ["rotas vazias", { code: "Ok", routes: [] }, "sem_rota"],
    ["formato errado", { x: 1 }, "resposta_invalida"],
  ])("%s", async (_n, corpo, motivo) => {
    const f = (async () => resposta(corpo)) as unknown as typeof fetch;
    await expect(mapasCom(f).rota({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, "carro")).rejects.toMatchObject({ motivo });
  });
});

describe("MapasError", () => {
  it("guarda o motivo", () => expect(new MapasError("timeout").motivo).toBe("timeout"));
});
