import { describe, expect, it } from "vitest";
import { adicionarDias, diasEntre, hojeRecife, soData } from "@/lib/datas";

describe("hojeRecife", () => {
  it("usa o fuso de Recife (UTC-3): 01h UTC ainda é o dia anterior", () => {
    expect(hojeRecife(new Date("2026-11-05T01:00:00Z"))).toBe("2026-11-04");
    expect(hojeRecife(new Date("2026-11-05T03:00:00Z"))).toBe("2026-11-05");
    expect(hojeRecife(new Date("2026-12-31T23:59:00Z"))).toBe("2026-12-31");
    expect(hojeRecife(new Date("2027-01-01T02:59:00Z"))).toBe("2026-12-31");
  });
});

describe("diasEntre", () => {
  it.each([
    ["2026-11-04", "2026-11-04", 0],
    ["2026-11-04", "2026-11-05", 1],
    ["2026-11-05", "2026-11-04", -1],
    ["2026-10-31", "2026-11-01", 1], // virada de mês
    ["2026-12-31", "2027-01-01", 1], // virada de ano
    ["2028-02-28", "2028-03-01", 2], // bissexto
    ["2027-02-28", "2027-03-01", 1], // não bissexto
    ["2026-01-01", "2027-01-01", 365],
    ["2028-01-01", "2029-01-01", 366],
  ])("%s → %s = %d", (a, b, n) => expect(diasEntre(a, b)).toBe(n));

  it("não é afetada por horário de verão (dias civis)", () => {
    expect(diasEntre("2018-11-03", "2018-11-04")).toBe(1);
    expect(diasEntre("2019-02-16", "2019-02-17")).toBe(1);
  });

  it("rejeita datas malformadas e inexistentes", () => {
    expect(() => diasEntre("04/11/2026", "2026-11-05")).toThrow(/inválida/);
    expect(() => diasEntre("2026-02-30", "2026-03-01")).toThrow(/inexistente/);
    expect(() => diasEntre("2026-13-01", "2026-03-01")).toThrow(/inexistente/);
  });
});

describe("adicionarDias / soData", () => {
  it.each([
    ["2026-11-04", 1, "2026-11-05"],
    ["2026-11-30", 1, "2026-12-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-11-04", -4, "2026-10-31"],
    ["2026-11-04", 0, "2026-11-04"],
  ])("%s + %d = %s", (d, n, esperado) => expect(adicionarDias(d, n)).toBe(esperado));

  it("soData", () => {
    expect(soData("2026-11-04T10:33:31")).toBe("2026-11-04");
    expect(soData("2026-11-04")).toBe("2026-11-04");
  });
});
