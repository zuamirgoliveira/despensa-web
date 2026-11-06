import { describe, expect, it } from "vitest";
import { validarProduto, valoresDoProduto } from "@/lib/formProduto";
import type { Produto } from "@/domain/types";

const produto: Produto = {
  id: crypto.randomUUID(), casaId: crypto.randomUUID(), nome: "Tomate", categoria: "hortifruti", unidade: "kg", meta: 1.5,
  metaManual: false, recorrente: true, frequencia: "semanal", tipoIda: "hortifruti_semanal", vidaUtilDias: 7, contavel: false, ativo: true,
};

describe("formulário de produto", () => {
  it("ida e volta dos valores (vírgula decimal)", () => {
    const v = valoresDoProduto(produto);
    expect(v.meta).toBe("1,5");
    const r = validarProduto(produto, v);
    expect(r).toEqual({ ok: true, produto });
  });

  it("aceita meta com vírgula e converte", () => {
    const r = validarProduto(produto, { ...valoresDoProduto(produto), meta: "2,25" });
    expect(r.ok && r.produto.meta).toBe(2.25);
  });

  it("campos opcionais vazios viram undefined", () => {
    const r = validarProduto({ ...produto, localCasa: "Geladeira" }, { ...valoresDoProduto(produto), localCasa: "  " });
    expect(r.ok && r.produto.localCasa).toBeUndefined();
  });

  it("erros por campo, em português", () => {
    const r = validarProduto(produto, { ...valoresDoProduto(produto), nome: " ", meta: "abc", unidade: "caixa" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.nome).toBe("Informe o nome do produto.");
      expect(r.erros.meta).toMatch(/maior ou igual a zero/);
      expect(r.erros.unidade).toBe("Escolha a unidade.");
      expect(r.erros.categoria).toBeUndefined();
    }
  });

  it("meta negativa é rejeitada", () => {
    const r = validarProduto(produto, { ...valoresDoProduto(produto), meta: "-1" });
    expect(r.ok).toBe(false);
  });

  it("frequência, tipo de ida, vida útil e contável não aparecem no formulário e são preservados ao salvar", () => {
    const original = { ...produto, frequencia: "mensal" as const, tipoIda: "feira_mensal" as const, vidaUtilDias: 90, contavel: true };
    expect(Object.keys(valoresDoProduto(original)).sort()).toEqual(["categoria", "localCasa", "mercadoPreferidoId", "meta", "nome", "recorrente", "unidade"]);
    const r = validarProduto(original, { ...valoresDoProduto(original), nome: "Tomate cereja" });
    expect(r.ok && r.produto).toMatchObject({ nome: "Tomate cereja", frequencia: "mensal", tipoIda: "feira_mensal", vidaUtilDias: 90, contavel: true });
  });

  it("o interruptor Repor sempre vai e volta pelo formulário", () => {
    const r = validarProduto(produto, { ...valoresDoProduto(produto), recorrente: false });
    expect(r.ok && r.produto.recorrente).toBe(false);
  });
});
