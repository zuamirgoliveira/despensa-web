import { describe, expect, it } from "vitest";
import { lerBackup } from "@/data/backup";
// @ts-expect-error módulo .mjs de script, sem tipos
import { gerarSeed } from "../scripts/seed-dev.mjs";
import { decodeKey } from "@/domain/nfce/chave";

describe("seed:dev", () => {
  it("gera um backup válido, com chaves de nota válidas e sem CPF", () => {
    const json = JSON.stringify(gerarSeed(new Date("2026-11-08T12:00:00Z")));
    const b = lerBackup(json);
    expect(b.colecoes.compras).toHaveLength(12);
    expect(b.colecoes.mercados).toHaveLength(2);
    expect(b.colecoes.produtos.length).toBeGreaterThan(5);
    for (const c of b.colecoes.compras) expect(decodeKey(c.chave).ok).toBe(true);
    expect(new Set(b.colecoes.compras.map((c) => c.chave)).size).toBe(12);
    expect(json).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });
});
