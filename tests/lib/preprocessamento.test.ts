import { describe, expect, it } from "vitest";
import { limiarOtsu, prepararPixels, TENTATIVAS_OCR } from "@/lib/preprocessamento";

const rgba = (...cinzas: number[]) => new Uint8ClampedArray(cinzas.flatMap((g) => [g, g, g, 255]));
const canal = (d: Uint8ClampedArray, i: number) => d[i * 4];

describe("prepararPixels", () => {
  it("converte para cinza com pesos 0,299/0,587/0,114 e mantém o alfa", () => {
    const d = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 10, 10, 10, 255]);
    prepararPixels(d, false);
    // sem contraste a esticar o resultado ainda é monotônico: vermelho > azul, verde > vermelho
    expect(d[3]).toBe(255);
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
    expect(canal(d, 1)).toBeGreaterThan(canal(d, 0));
    expect(canal(d, 0)).toBeGreaterThan(canal(d, 2));
  });

  it("estica o contraste entre os percentis 2% e 98%", () => {
    const pixels = Array.from({ length: 100 }, (_, i) => 100 + Math.round(i / 3)); // 100..133
    const d = rgba(...pixels);
    prepararPixels(d, false);
    const valores = Array.from({ length: 100 }, (_, i) => canal(d, i));
    expect(Math.min(...valores)).toBe(0);
    expect(Math.max(...valores)).toBe(255);
  });

  it("imagem uniforme não divide por zero", () => {
    const d = rgba(80, 80, 80, 80);
    expect(() => prepararPixels(d, false)).not.toThrow();
    expect(() => prepararPixels(rgba(80, 80), true)).not.toThrow();
  });

  it("imagem vazia é aceita", () => expect(() => prepararPixels(new Uint8ClampedArray(0), true)).not.toThrow());

  it("binarizar com Otsu separa fundo claro de texto escuro", () => {
    const pixels = [...Array(60).fill(220), ...Array(40).fill(30)];
    const d = rgba(...pixels);
    prepararPixels(d, true);
    const valores = new Set(Array.from({ length: 100 }, (_, i) => canal(d, i)));
    expect([...valores].sort((a, b) => a - b)).toEqual([0, 255]);
    expect(canal(d, 0)).toBe(255);
    expect(canal(d, 99)).toBe(0);
  });
});

describe("limiarOtsu", () => {
  it("fica entre as duas modas", () => {
    const h = new Uint32Array(256);
    h[40] = 50;
    h[200] = 50;
    const t = limiarOtsu(h, 100);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(200);
  });
  it("histograma de um único nível devolve o padrão 128", () => {
    const h = new Uint32Array(256);
    h[90] = 10;
    expect(limiarOtsu(h, 10)).toBe(128);
  });
});

describe("TENTATIVAS_OCR", () => {
  it("segue a ordem do AGENTS.md 7.6", () => {
    expect(TENTATIVAS_OCR).toEqual([
      { larguraAlvo: 1800, binarizar: false },
      { larguraAlvo: 1800, binarizar: true },
      { larguraAlvo: 2600, binarizar: false },
    ]);
  });
});
