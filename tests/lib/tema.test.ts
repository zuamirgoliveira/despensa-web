import { describe, expect, it } from "vitest";
import { aplicarPreferencia, CHAVE_TEMA, lerPreferencia, salvarPreferencia } from "@/lib/tema";

function armazenamento(inicial: Record<string, string> = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k: string) => dados[k] ?? null,
    setItem: (k: string, v: string) => void (dados[k] = v),
    removeItem: (k: string) => void delete dados[k],
  };
}
function documento() {
  const attrs: Record<string, string> = {};
  const doc = {
    attrs,
    documentElement: {
      setAttribute: (k: string, v: string) => void (attrs[k] = v),
      removeAttribute: (k: string) => void delete attrs[k],
    },
  };
  return doc as unknown as Document & { attrs: Record<string, string> };
}

describe("preferência de tema", () => {
  it.each([
    [{}, "sistema"],
    [{ [CHAVE_TEMA]: "claro" }, "claro"],
    [{ [CHAVE_TEMA]: "escuro" }, "escuro"],
    [{ [CHAVE_TEMA]: "azul" }, "sistema"],
  ] as const)("lê %j como %s", (inicial, esperado) => {
    expect(lerPreferencia(armazenamento(inicial))).toBe(esperado);
  });

  it("sem armazenamento ou com erro de leitura volta a Sistema", () => {
    expect(lerPreferencia(undefined)).toBe("sistema");
    expect(
      lerPreferencia({
        getItem: () => {
          throw new Error("bloqueado");
        },
      }),
    ).toBe("sistema");
  });

  it("claro/escuro gravam e aplicam data-tema; sistema apaga os dois", () => {
    const arm = armazenamento();
    const doc = documento();
    salvarPreferencia("escuro", doc, arm);
    expect(arm.dados[CHAVE_TEMA]).toBe("escuro");
    expect(doc.attrs["data-tema"]).toBe("escuro");
    salvarPreferencia("sistema", doc, arm);
    expect(arm.dados[CHAVE_TEMA]).toBeUndefined();
    expect(doc.attrs["data-tema"]).toBeUndefined();
  });

  it("aplica o atributo mesmo se o armazenamento falhar", () => {
    const doc = documento();
    salvarPreferencia(
      "claro",
      doc,
      {
        setItem: () => {
          throw new Error("cheio");
        },
        removeItem: () => undefined,
      },
    );
    expect(doc.attrs["data-tema"]).toBe("claro");
    aplicarPreferencia("sistema", doc);
    expect(doc.attrs["data-tema"]).toBeUndefined();
  });
});
