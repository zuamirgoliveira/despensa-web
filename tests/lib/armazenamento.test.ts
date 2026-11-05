import { describe, expect, it, vi } from "vitest";
import { estadoArmazenamento, pedirPersistencia } from "@/lib/armazenamento";

describe("pedirPersistencia", () => {
  it("sem suporte devolve null e não quebra", async () => {
    expect(await pedirPersistencia(undefined)).toBeNull();
    expect(await pedirPersistencia({})).toBeNull();
  });
  it("já persistente: não pede de novo", async () => {
    const persist = vi.fn(async () => true);
    expect(await pedirPersistencia({ persisted: async () => true, persist })).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });
  it("pede quando ainda não é persistente e devolve a resposta do navegador", async () => {
    expect(await pedirPersistencia({ persisted: async () => false, persist: async () => true })).toBe(true);
    expect(await pedirPersistencia({ persisted: async () => false, persist: async () => false })).toBe(false);
    expect(await pedirPersistencia({ persist: async () => true })).toBe(true); // sem persisted()
  });
  it("erro do navegador vira null", async () => {
    expect(
      await pedirPersistencia({
        persist: async () => {
          throw new Error("negado");
        },
      }),
    ).toBeNull();
  });
});

describe("estadoArmazenamento", () => {
  it("sem suporte", async () => {
    expect(await estadoArmazenamento(undefined)).toEqual({ suportado: false, persistente: null });
  });
  it("informa persistência, uso e cota", async () => {
    expect(await estadoArmazenamento({ persisted: async () => true, estimate: async () => ({ usage: 2048, quota: 1_000_000 }) })).toEqual({
      suportado: true,
      persistente: true,
      usoBytes: 2048,
      cotaBytes: 1_000_000,
    });
  });
  it("erro ao consultar não derruba a tela", async () => {
    const s = await estadoArmazenamento({
      persisted: async () => {
        throw new Error("x");
      },
    });
    expect(s).toEqual({ suportado: true, persistente: null });
  });
});
