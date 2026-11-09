// Regras permanentes (AGENTS.md 9.3 e 13) verificadas no código-fonte.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}
const fontes = arquivos("src").map((p) => ({ p, s: readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "") }));

const PROIBIDOS: [string, RegExp][] = [
  ["watchPosition (nunca rastrear localização)", /watchPosition/],
  ["innerHTML", /innerHTML/],
  ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
  ["eval()", /(^|[^.\w])eval\s*\(/],
  ["window.confirm", /(window\.)?\bconfirm\s*\(/],
  ["window.alert", /(window\.)?\balert\s*\(/],
  ["window.prompt", /(window\.)?\bprompt\s*\(/],
  ["document.write", /document\.write\s*\(/],
];

describe("regras de segurança no código-fonte", () => {
  it.each(PROIBIDOS)("não usa %s", (_nome, re) => {
    const achados = fontes.filter((f) => re.test(f.s)).map((f) => f.p);
    expect(achados).toEqual([]);
  });

  it("src/domain não importa React nem IndexedDB", () => {
    const ruins = fontes.filter((f) => f.p.includes("/domain/") && /from "react|indexedDB|from "@\/data|from "next/.test(f.s)).map((f) => f.p);
    expect(ruins).toEqual([]);
  });

  it("só src/data/indexeddb toca no indexedDB", () => {
    const ruins = fontes.filter((f) => !f.p.includes("/data/indexeddb/") && /\bindexedDB\b|IDBDatabase/.test(f.s)).map((f) => f.p);
    expect(ruins).toEqual([]);
  });

  it("a única rota de API é o proxy da consulta do QR (AGENTS.md 5.5); sem middleware", () => {
    const rotas = arquivos("src").filter((p) => /app\/api\/|middleware\.ts|proxy\.ts/.test(p));
    expect(rotas.map((p) => p.replace(/\\/g, "/").replace(/^.*src\//, "src/"))).toEqual(["src/app/api/nfce/route.ts"]);
  });
});
