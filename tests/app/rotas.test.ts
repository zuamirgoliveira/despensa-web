import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROTAS } from "@/lib/rotas";

describe("rotas", () => {
  it.each(ROTAS.map((r) => r.href))("%s tem página em src/app", (href) => {
    const dir = new URL(`../../src/app${href === "/" ? "" : href}/page.tsx`, import.meta.url);
    expect(existsSync(dir)).toBe(true);
  });
});
