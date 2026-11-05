import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aplicarCustoNasCompras, confirmarEstimativa, estimarMercado } from "@/data/estimativaIda";
import { criarRepositorios } from "@/data/indexeddb";
import type { Repositorios } from "@/data/repositorios";
import type { Mercado } from "@/domain/types";
import { MapasError, type Mapas } from "@/lib/mapas";

const ENDERECO = "AVENIDA GOVERNADOR CARLOS DE LIMA CAVALC ,  1245 ,  CASA CAIADA ,  OLINDA ,  PE";
let repos: Repositorios;
let mercado: Mercado;

beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
  const casa = (await repos.casas.listar())[0];
  mercado = await repos.mercados.salvar({
    id: crypto.randomUUID(), casaId: casa.id, cnpj: "08868231000638", nome: "Cia Santos", endereco: ENDERECO, tipo: "hortifruti", transporte: "carro",
  });
});
afterEach(() => repos.fechar());

const comCasa = async () => {
  const perfil = (await repos.perfis.listar())[0];
  await repos.perfis.salvar({ ...perfil, localizacaoCasa: { lat: -8.063, lng: -34.871 } });
};
const mapasOk = (): Mapas & { geo: ReturnType<typeof vi.fn>; rota: ReturnType<typeof vi.fn> } => {
  const geo = vi.fn(async (q: string) => (q === "Casa Caiada, Olinda, PE, Brasil" ? { lat: -7.9847, lng: -34.8383, nome: "x" } : null));
  const rota = vi.fn(async (_o: unknown, _d: unknown, meio: string) => (meio === "bike" ? { km: 12.0096, min: 50.5 } : { km: 10.7033, min: 12.02 }));
  return { geocodificar: geo, rota, geo } as never;
};
const semEsperar = async () => undefined;

describe("estimarMercado", () => {
  it("sem casa cadastrada: não bloqueia, devolve sem_casa e não chama o serviço", async () => {
    const m = mapasOk();
    expect(await estimarMercado(repos, m, mercado.id, "carro", { esperar: semEsperar })).toEqual({ status: "sem_casa" });
    expect(m.geo).not.toHaveBeenCalled();
  });

  it("sem internet: offline, sem chamar o serviço", async () => {
    await comCasa();
    const m = mapasOk();
    expect(await estimarMercado(repos, m, mercado.id, "carro", { online: false })).toEqual({ status: "offline" });
    expect(m.geo).not.toHaveBeenCalled();
  });

  it("sucesso (aproximado por bairro): distância e tempo do carro; guarda as coordenadas do mercado", async () => {
    await comCasa();
    const m = mapasOk();
    const r = await estimarMercado(repos, m, mercado.id, "carro", { esperar: semEsperar });
    expect(r).toMatchObject({ status: "ok", distanciaKm: 10.7, tempoMin: 12, aproximado: true, estimadaPorFator: false });
    expect((await repos.mercados.obter(mercado.id))?.coordenadas).toEqual({ lat: -7.9847, lng: -34.8383 });
  });

  it("cache por mercado: a segunda estimativa não geocodifica de novo", async () => {
    await comCasa();
    const m = mapasOk();
    await estimarMercado(repos, m, mercado.id, "carro", { esperar: semEsperar });
    const chamadas = m.geo.mock.calls.length;
    const r = await estimarMercado(repos, m, mercado.id, "bike_eletrica", { esperar: semEsperar });
    expect(m.geo.mock.calls.length).toBe(chamadas);
    expect(r).toMatchObject({ status: "ok", distanciaKm: 12, tempoMin: 51, aproximado: false });
    expect(m.rota.mock.calls.map((c) => c[2])).toEqual(["carro", "bike"]);
  });

  it("endereço não encontrado", async () => {
    await comCasa();
    const m: Mapas = { geocodificar: async () => null, rota: async () => ({ km: 1, min: 1 }) };
    expect(await estimarMercado(repos, m, mercado.id, "carro", { esperar: semEsperar })).toEqual({ status: "endereco_nao_encontrado" });
    expect((await repos.mercados.obter(mercado.id))?.coordenadas).toBeUndefined();
  });

  it.each([
    ["timeout", "falha"],
    ["http", "falha"],
    ["resposta_invalida", "falha"],
    ["rede", "offline"],
  ] as const)("erro do serviço (%s) vira status %s, sem lançar", async (motivo, status) => {
    await comCasa();
    const m: Mapas = {
      geocodificar: async () => {
        throw new MapasError(motivo);
      },
      rota: async () => ({ km: 1, min: 1 }),
    };
    expect(await estimarMercado(repos, m, mercado.id, "carro", { esperar: semEsperar })).toMatchObject({ status });
  });

  it("mercado inexistente: sem_casa (nada a estimar)", async () => {
    expect((await estimarMercado(repos, mapasOk(), crypto.randomUUID(), "carro")).status).toBe("sem_casa");
  });
});

describe("confirmarEstimativa", () => {
  const compra = async (chave: string, custo?: number) => {
    const casa = (await repos.casas.listar())[0];
    return repos.compras.salvar({
      casaId: casa.id, chave, mercadoId: mercado.id, emissao: "2026-11-04T10:00:00", valorTotalCentavos: 7724, pagamento: "", itens: [],
      importadoEm: "2026-11-05T10:00:00Z", custoIdaCentavos: custo,
    });
  };

  it("guarda meio, distância e tempo no mercado e o custo (ida e volta) nas compras sem custo", async () => {
    await compra("1".repeat(44));
    await compra("2".repeat(44), 999); // já tem custo: não muda
    const r = await confirmarEstimativa(repos, mercado.id, { meio: "carro", distanciaKm: 4.2, tempoMin: 12 });
    expect(r.custoIdaCentavos).toBe(756); // 8,4 km × R$ 0,90
    expect(r.mercado).toMatchObject({ transporte: "carro", distanciaKm: 4.2, tempoMinIda: 12 });
    expect((await repos.compras.obter("1".repeat(44)))?.custoIdaCentavos).toBe(756);
    expect((await repos.compras.obter("2".repeat(44)))?.custoIdaCentavos).toBe(999);
  });

  it("bike elétrica: R$ 0,05 por km", async () => {
    await compra("1".repeat(44));
    const r = await confirmarEstimativa(repos, mercado.id, { meio: "bike_eletrica", distanciaKm: 4.2 });
    expect(r.custoIdaCentavos).toBe(42);
    expect((await repos.mercados.obter(mercado.id))?.tempoMinIda).toBeUndefined();
  });

  it("mercado inexistente lança erro claro", async () => {
    await expect(confirmarEstimativa(repos, crypto.randomUUID(), { meio: "carro", distanciaKm: 1 })).rejects.toThrow(/não encontrado/);
  });

  it("aplicarCustoNasCompras sem distância não faz nada", async () => {
    await compra("1".repeat(44));
    expect(await aplicarCustoNasCompras(repos, mercado)).toBeUndefined();
    expect((await repos.compras.obter("1".repeat(44)))?.custoIdaCentavos).toBeUndefined();
  });
});
