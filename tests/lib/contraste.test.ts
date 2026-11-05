// Contraste WCAG dos tokens de tema (docs/design.md seção 2). Lê as variáveis de src/app/globals.css:
// mudar uma cor para abaixo do mínimo quebra este teste.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type RGB = [number, number, number];
type Tema = Record<string, RGB>;

const css = readFileSync("src/app/globals.css", "utf8");

function bloco(inicio: RegExp): string {
  const m = inicio.exec(css);
  if (!m) throw new Error(`bloco não encontrado: ${inicio}`);
  const abre = css.indexOf("{", m.index + m[0].length - 1);
  let nivel = 0;
  for (let i = abre; i < css.length; i++) {
    if (css[i] === "{") nivel++;
    if (css[i] === "}" && --nivel === 0) return css.slice(abre + 1, i);
  }
  throw new Error("bloco sem fim");
}

function variaveis(texto: string): Tema {
  const t: Tema = {};
  for (const m of texto.matchAll(/--([a-z-]+):\s*(\d+) (\d+) (\d+);/g)) t[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  return t;
}

const claro = variaveis(bloco(/^:root\s*\{/m));
const escuroSistema = variaveis(bloco(/:root:not\(\[data-tema="claro"\]\)\s*\{/));
const escuroManual = variaveis(bloco(/:root\[data-tema="escuro"\]\s*\{/));

const lum = ([r, g, b]: RGB): number => {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const razao = (a: RGB, b: RGB): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const mistura = (cor: RGB, fundo: RGB, alfa: number): RGB => [0, 1, 2].map((i) => Math.round(cor[i] * alfa + fundo[i] * (1 - alfa))) as RGB;

const TEMAS: [string, Tema][] = [
  ["claro", claro],
  ["escuro", escuroSistema],
];

describe("tokens de tema", () => {
  it("os dois blocos escuros são idênticos (sistema e escolha manual)", () => {
    expect(Object.keys(escuroSistema).length).toBeGreaterThan(10);
    expect(escuroManual).toEqual(escuroSistema);
  });

  it("o tema escuro define todos os tokens do claro", () => {
    expect(Object.keys(escuroSistema).sort()).toEqual(Object.keys(claro).sort());
  });
});

describe.each(TEMAS)("contraste no tema %s", (_nome, t) => {
  const fundos: [string, RGB][] = [
    ["fundo", t.fundo],
    ["superficie", t.superficie],
  ];

  it.each(["texto", "suave", "primario", "sucesso", "aviso", "erro"])("%s tem ≥ 4,5:1 sobre fundo e superfície", (token) => {
    for (const [nome, bg] of fundos) expect(razao(t[token], bg), `${token} sobre ${nome}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["primario-fg", "primario"],
    ["erro-fg", "erro"],
    ["cabecalho-fg", "cabecalho"],
  ])("%s sobre %s tem ≥ 4,5:1", (fg, bg) => {
    expect(razao(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["primario", "sucesso", "aviso", "erro"])("texto %s sobre o próprio tom a 12% (Alert/Badge) tem ≥ 4,5:1", (token) => {
    for (const [nome, bg] of fundos) expect(razao(t[token], mistura(t[token], bg, 0.12)), `${token} sobre ${nome}`).toBeGreaterThanOrEqual(4.5);
  });

  it("contorno de controles (borda-forte) tem ≥ 3:1", () => {
    for (const [nome, bg] of fundos) expect(razao(t["borda-forte"], bg), nome).toBeGreaterThanOrEqual(3);
  });

  it("detalhe dourado (destaque) tem ≥ 3:1 sobre fundo, superfície e cabeçalho", () => {
    for (const [nome, bg] of [...fundos, ["cabecalho", t.cabecalho] as [string, RGB]]) expect(razao(t.destaque, bg), nome).toBeGreaterThanOrEqual(3);
  });
});
