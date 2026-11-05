import { describe, expect, it } from "vitest";
import { centavosParaCampo, reaisParaCentavos } from "@/lib/dinheiro";

describe("reaisParaCentavos", () => {
  it.each([
    ["6,49", 649],
    ["6", 600],
    ["0,05", 5],
    ["1.234,50", 123450],
    [" 7,9 ", 790],
    ["6.49", 64900], // ponto é separador de milhar no padrão brasileiro
  ])("%s → %d", (entrada, esperado) => expect(reaisParaCentavos(entrada)).toBe(esperado));
  it.each([[""], ["  "], ["abc"], ["-3"]])("inválido ou vazio: %j", (entrada) => expect(reaisParaCentavos(entrada)).toBeUndefined());
});

describe("centavosParaCampo", () => {
  it("ida e volta", () => {
    expect(centavosParaCampo(649)).toBe("6,49");
    expect(centavosParaCampo(5)).toBe("0,05");
    expect(centavosParaCampo(undefined)).toBe("");
    expect(reaisParaCentavos(centavosParaCampo(123456))).toBe(123456);
  });
});
