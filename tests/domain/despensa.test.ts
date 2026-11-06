import { describe, expect, it } from "vitest";
import { converterEstoqueLegado, quantidadeDoNivel } from "@/domain/despensa";
import type { Compra } from "@/domain/types";

const base = { id: "e", casaId: "c", produtoId: "p", confirmadoEm: "2026-11-01T10:00:00Z" };
const compra = (quantidade: number): Compra =>
  ({ casaId: "c", chave: "1", mercadoId: "m", emissao: "2026-10-01T10:00:00", valorTotalCentavos: 1, pagamento: "", importadoEm: "x",
    itens: [{ codigo: "1", descricao: "X", produtoId: "p", quantidade, unidade: "UNID", valorUnitarioCentavos: 1, valorTotalCentavos: 1 }] }) as Compra;

describe("quantidadeDoNivel", () => {
  it.each([["cheio", 10, 10], ["metade", 10, 5], ["acabando", 10, 2], ["acabou", 10, 0], ["cheio", 0, 0]] as const)(
    "%s de %d = %d", (nivel, ref, esperado) => expect(quantidadeDoNivel(nivel, ref)).toBeCloseTo(esperado),
  );
});

describe("converterEstoqueLegado", () => {
  it("nível × meta", () => {
    expect(converterEstoqueLegado({ ...base, nivel: "metade" }, { id: "p", meta: 4 }, []).quantidade).toBe(2);
  });
  it("sem meta, usa a última quantidade comprada", () => {
    expect(converterEstoqueLegado({ ...base, nivel: "cheio" }, { id: "p", meta: 0 }, [compra(3)]).quantidade).toBe(3);
  });
  it("sem meta e sem compra, fica 0", () => {
    expect(converterEstoqueLegado({ ...base, nivel: "cheio" }, { id: "p", meta: 0 }, []).quantidade).toBe(0);
  });
  it("quantidadeExata prevalece sobre o nível", () => {
    expect(converterEstoqueLegado({ ...base, nivel: "metade", quantidadeExata: 7 }, { id: "p", meta: 4 }, []).quantidade).toBe(7);
  });
  it("quantidade já existente é mantida (inclusive acima da meta)", () => {
    expect(converterEstoqueLegado({ ...base, nivel: "cheio", quantidade: 9 }, { id: "p", meta: 4 }, []).quantidade).toBe(9);
  });
  it("produto desconhecido: 0, exceto quantidadeExata", () => {
    expect(converterEstoqueLegado({ ...base, nivel: "cheio" }, undefined, []).quantidade).toBe(0);
  });
});
