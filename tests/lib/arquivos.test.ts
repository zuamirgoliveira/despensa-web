import { describe, expect, it, vi } from "vitest";
import { compartilharArquivo, compartilharTexto, criarArquivo } from "@/lib/arquivos";

const arquivo = criarArquivo("{}", "despensa-backup-2026-11-05.json");

describe("compartilharArquivo", () => {
  it("compartilha quando o navegador aceita arquivos", async () => {
    const share = vi.fn(async () => undefined);
    expect(await compartilharArquivo(arquivo, "Despensa", { canShare: () => true, share })).toBe("compartilhado");
    expect(share).toHaveBeenCalledWith({ files: [arquivo], title: "Despensa" });
  });
  it("fechar o menu é 'cancelado' (AbortError), não erro", async () => {
    const share = async () => {
      throw new DOMException("cancelado", "AbortError");
    };
    expect(await compartilharArquivo(arquivo, "x", { canShare: () => true, share })).toBe("cancelado");
  });
  it("sem share, sem canShare ou canShare recusando arquivos: indisponível (cai no download)", async () => {
    expect(await compartilharArquivo(arquivo, "x", undefined)).toBe("indisponivel");
    expect(await compartilharArquivo(arquivo, "x", {})).toBe("indisponivel");
    expect(await compartilharArquivo(arquivo, "x", { canShare: () => false, share: async () => undefined })).toBe("indisponivel");
  });
  it("outro erro do navegador também cai no download", async () => {
    const share = async () => {
      throw new DOMException("sem permissão", "NotAllowedError");
    };
    expect(await compartilharArquivo(arquivo, "x", { canShare: () => true, share })).toBe("indisponivel");
  });
  it("criarArquivo guarda nome, tipo e conteúdo", async () => {
    expect(arquivo.name).toBe("despensa-backup-2026-11-05.json");
    expect(arquivo.type).toBe("application/json");
    expect(await arquivo.text()).toBe("{}");
  });
});

describe("compartilharTexto", () => {
  it("abre o menu com título e texto", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await compartilharTexto("• Alho: 2 un", "Lista de compras", { share })).toBe("compartilhado");
    expect(share).toHaveBeenCalledWith({ title: "Lista de compras", text: "• Alho: 2 un" });
  });
  it("fechar o menu é cancelar; sem suporte ou erro é indisponível", async () => {
    expect(await compartilharTexto("x", "t", { share: vi.fn().mockRejectedValue(new DOMException("fechou", "AbortError")) })).toBe("cancelado");
    expect(await compartilharTexto("x", "t", { share: vi.fn().mockRejectedValue(new Error("falhou")) })).toBe("indisponivel");
    expect(await compartilharTexto("x", "t", {})).toBe("indisponivel");
    expect(await compartilharTexto("x", "t", undefined)).toBe("indisponivel");
  });
});
