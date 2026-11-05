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
