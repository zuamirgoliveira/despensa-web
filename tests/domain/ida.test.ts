import { describe, expect, it } from "vitest";
import { custoPorKmCarro } from "@/domain/ida";

describe("custoPorKmCarro", () => {
  it.each([
    [{ consumoKmPorLitro: 10, precoCombustivelCentavos: 600, desgasteCentavosPorKm: 30 }, 90], // R$ 0,60 + R$ 0,30
    [{ consumoKmPorLitro: 12, precoCombustivelCentavos: 600, desgasteCentavosPorKm: 0 }, 50],
    [{ consumoKmPorLitro: 8, precoCombustivelCentavos: 0, desgasteCentavosPorKm: 25 }, 25],
    [{ consumoKmPorLitro: 7, precoCombustivelCentavos: 650, desgasteCentavosPorKm: 30 }, 650 / 7 + 30],
  ])("%j → %d centavos/km", (carro, esperado) => expect(custoPorKmCarro(carro)).toBeCloseTo(esperado));
});

import { custoIda, custoIdaDoMercado, custoRealCompra, estatisticasDeIdas } from "@/domain/ida";

const perfil = {
  carro: { consumoKmPorLitro: 10, precoCombustivelCentavos: 600, desgasteCentavosPorKm: 30 }, // 90 centavos/km
  bikeCentavosPorKm: 5,
};

describe("custoIda", () => {
  it.each([
    ["carro, 8,4 km", { meio: "carro" as const, kmIdaVolta: 8.4 }, 756],
    ["carro com estacionamento fixo de R$ 5,00", { meio: "carro" as const, kmIdaVolta: 8.4, custoFixoCentavos: 500 }, 1256],
    ["carro, 0 km sem fixo", { meio: "carro" as const, kmIdaVolta: 0 }, 0],
    ["bike, 8,4 km", { meio: "bike_eletrica" as const, kmIdaVolta: 8.4 }, 42],
    ["bike ignora custo fixo", { meio: "bike_eletrica" as const, kmIdaVolta: 8.4, custoFixoCentavos: 500 }, 42],
    ["a pé não custa nada", { meio: "a_pe" as const, kmIdaVolta: 4, custoFixoCentavos: 500 }, 0],
    ["bike, 10 km (R$ 0,50)", { meio: "bike_eletrica" as const, kmIdaVolta: 10 }, 50],
  ])("%s", (_nome, entrada, esperado) => expect(custoIda({ ...entrada, perfil })).toBe(esperado));

  it("arredonda ao centavo mais próximo", () => {
    // 1,3 km × 0,90 = 117 ; 0,33 km × 90 = 29,7 → 30
    expect(custoIda({ meio: "carro", kmIdaVolta: 0.33, perfil })).toBe(30);
    expect(custoIda({ meio: "bike_eletrica", kmIdaVolta: 0.5, perfil: { ...perfil, bikeCentavosPorKm: 5 } })).toBe(3); // 2,5 → 3
  });

  it("o tempo não entra na conta (a função nem o recebe)", () => {
    expect(custoIda.length).toBe(1);
  });
});

describe("custoIdaDoMercado", () => {
  it("distância é de ida: o custo usa ida e volta", () => {
    expect(custoIdaDoMercado({ transporte: "carro", distanciaKm: 4.2 }, perfil)).toBe(756);
    expect(custoIdaDoMercado({ transporte: "bike_eletrica", distanciaKm: 4.2 }, perfil)).toBe(42);
    expect(custoIdaDoMercado({ transporte: "carro", distanciaKm: 4.2, custoFixoIdaCentavos: 300 }, perfil)).toBe(1056);
  });
  it("sem distância conhecida: undefined", () => expect(custoIdaDoMercado({ transporte: "carro" }, perfil)).toBeUndefined());
  it("distância zero é conhecida e custa zero", () => expect(custoIdaDoMercado({ transporte: "carro", distanciaKm: 0 }, perfil)).toBe(0));
});

describe("custoRealCompra", () => {
  it("itens + ida", () => expect(custoRealCompra(7724, 756)).toBe(8480));
});

describe("estatisticasDeIdas", () => {
  const m1 = { id: "m1", tempoMinIda: 12 };
  const m2 = { id: "m2", tempoMinIda: undefined };
  const compra = (emissao: string, mercadoId: string, custoIdaCentavos?: number) => ({ emissao, mercadoId, custoIdaCentavos });

  it("conta só o mês pedido; minutos = tempo de ida × 2; separa o que não tem estimativa", () => {
    const e = estatisticasDeIdas(
      [compra("2026-11-04T10:00:00", "m1", 756), compra("2026-11-11T10:00:00", "m1", 756), compra("2026-11-20T10:00:00", "m2"), compra("2026-10-30T10:00:00", "m1", 756)],
      [m1, m2],
      2026,
      11,
    );
    expect(e).toEqual({ idas: 3, minutos: 48, semEstimativa: 1, custoTotalCentavos: 1512 });
  });
  it("mês sem compras e mercado desconhecido", () => {
    expect(estatisticasDeIdas([], [m1], 2026, 11)).toEqual({ idas: 0, minutos: 0, semEstimativa: 0, custoTotalCentavos: 0 });
    expect(estatisticasDeIdas([compra("2026-11-04T10:00:00", "x")], [m1], 2026, 11)).toMatchObject({ idas: 1, semEstimativa: 1, minutos: 0 });
  });
  it("mês com um dígito (janeiro) casa o prefixo certo", () => {
    expect(estatisticasDeIdas([compra("2027-01-05T10:00:00", "m1")], [m1], 2027, 1).idas).toBe(1);
  });
});
