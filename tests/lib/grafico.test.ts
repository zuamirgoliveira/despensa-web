import { describe, expect, it } from "vitest";
import { pontosDoGrafico } from "@/lib/grafico";

describe("pontosDoGrafico", () => {
  it("vazio", () => expect(pontosDoGrafico([], 100, 50)).toEqual([]));
  it("um ponto fica no centro", () => expect(pontosDoGrafico([5], 100, 50)).toEqual([{ x: 50, y: 25 }]));
  it("série constante fica na linha do meio", () => {
    expect(pontosDoGrafico([3, 3, 3], 100, 50).map((p) => p.y)).toEqual([25, 25, 25]);
  });
  it("menor valor embaixo, maior em cima, x espaçado entre as margens", () => {
    const p = pontosDoGrafico([10, 20, 15], 100, 50, 10);
    expect(p[0]).toEqual({ x: 10, y: 40 });
    expect(p[1]).toEqual({ x: 50, y: 10 });
    expect(p[2]).toEqual({ x: 90, y: 25 });
  });
});
