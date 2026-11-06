import { describe, expect, it, vi } from "vitest";
import { ligarFocoContinuo, modosDeFoco, refocar } from "@/lib/qr";

type Trilha = Parameters<typeof ligarFocoContinuo>[0];
const trilha = (modos: string[] | undefined, aceita: (m: string) => boolean = () => true) => {
  const aplicados: string[] = [];
  const t: Trilha = {
    getCapabilities: modos === undefined ? undefined : () => ({ focusMode: modos }),
    applyConstraints: vi.fn(async (c?: MediaTrackConstraints) => {
      const modo = (c?.advanced?.[0] as { focusMode?: string } | undefined)?.focusMode ?? "";
      aplicados.push(modo);
      if (!aceita(modo)) throw new Error("recusado");
    }),
  };
  return { t, aplicados };
};

describe("modosDeFoco", () => {
  it("lê os modos declarados; sem informação, vazio", () => {
    expect(modosDeFoco(trilha(["manual", "continuous"]).t)).toEqual(["manual", "continuous"]);
    expect(modosDeFoco(trilha(undefined).t)).toEqual([]);
    expect(modosDeFoco({ getCapabilities: () => ({}) })).toEqual([]);
  });
});

describe("ligarFocoContinuo", () => {
  it("câmera com foco contínuo: liga e informa continuo", async () => {
    const { t, aplicados } = trilha(["none", "continuous", "single-shot"]);
    expect(await ligarFocoContinuo(t)).toBe("continuo");
    expect(aplicados).toEqual(["continuous"]);
  });
  it("só foco pontual: manual, sem tentar o contínuo", async () => {
    const { t, aplicados } = trilha(["single-shot"]);
    expect(await ligarFocoContinuo(t)).toBe("manual");
    expect(aplicados).toEqual([]);
  });
  it("declara só 'none': indisponível", async () => {
    expect(await ligarFocoContinuo(trilha(["none"]).t)).toBe("indisponivel");
  });
  it("sem getCapabilities: tenta e confirma pelo resultado", async () => {
    expect(await ligarFocoContinuo(trilha(undefined).t)).toBe("continuo");
    expect(await ligarFocoContinuo(trilha(undefined, () => false).t)).toBe("indisponivel");
  });
  it("declara contínuo mas o aparelho recusa: não diz que está ligado", async () => {
    expect(await ligarFocoContinuo(trilha(["continuous"], () => false).t)).toBe("indisponivel");
  });
});

describe("refocar", () => {
  it("foco pontual e volta ao contínuo", async () => {
    vi.useFakeTimers();
    const { t, aplicados } = trilha(["continuous", "single-shot"]);
    const p = refocar(t, "continuo");
    await vi.advanceTimersByTimeAsync(1300);
    expect(await p).toBe(true);
    expect(aplicados).toEqual(["single-shot", "continuous"]);
    vi.useRealTimers();
  });
  it("indisponível não faz nada", async () => {
    const { t, aplicados } = trilha(["continuous"]);
    expect(await refocar(t, "indisponivel")).toBe(false);
    expect(aplicados).toEqual([]);
  });
  it("sem foco pontual, alterna manual → contínuo", async () => {
    vi.useFakeTimers();
    const { t, aplicados } = trilha(["manual", "continuous"]);
    const p = refocar(t, "continuo");
    await vi.advanceTimersByTimeAsync(200);
    expect(await p).toBe(true);
    expect(aplicados).toEqual(["manual", "continuous"]);
    vi.useRealTimers();
  });
});
