import { describe, expect, it } from "vitest";
import { brl, dataBR, horaBR, kg, numeroBR } from "@/lib/format";

describe("brl", () => {
  it.each([
    [0, "R$ 0,00"],
    [5, "R$ 0,05"],
    [100, "R$ 1,00"],
    [7724, "R$ 77,24"],
    [123456, "R$ 1.234,56"],
    [100000000, "R$ 1.000.000,00"],
    [-150, "-R$ 1,50"],
    [99.6, "R$ 1,00"],
  ])("%d → %s", (c, esperado) => expect(brl(c)).toBe(esperado));
});

describe("dataBR / horaBR", () => {
  it("data com e sem hora", () => {
    expect(dataBR("2026-11-04")).toBe("04/11/2026");
    expect(dataBR("2026-11-04T10:33:31")).toBe("04/11/2026");
    expect(dataBR("lixo")).toBe("");
    expect(dataBR("")).toBe("");
  });
  it("hora", () => {
    expect(horaBR("2026-11-04T10:33:31")).toBe("10:33");
    expect(horaBR("2026-11-04")).toBe("");
  });
});

describe("kg / numeroBR", () => {
  it.each([
    [1.26, "1,26 kg"],
    [2, "2 kg"],
    [0.796, "0,796 kg"],
    [0.1 + 0.2, "0,3 kg"],
    [0, "0 kg"],
  ])("kg(%d) → %s", (n, esperado) => expect(kg(n)).toBe(esperado));
  it("numeroBR", () => {
    expect(numeroBR(1.5)).toBe("1,5");
    expect(numeroBR(3)).toBe("3");
    expect(numeroBR(1.23456, 2)).toBe("1,23");
  });
});
