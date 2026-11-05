import { describe, expect, it } from "vitest";
import { historicoPorProduto, variacaoPct } from "@/domain/precos";
import type { Compra } from "@/domain/types";

const casaId = crypto.randomUUID();
const mercadoA = crypto.randomUUID();
const mercadoB = crypto.randomUUID();
const tomate = crypto.randomUUID();
const alho = crypto.randomUUID();

const compra = (n: number, emissao: string, mercadoId: string, itens: Compra["itens"]): Compra => ({
  casaId, chave: String(n).padStart(44, "0"), mercadoId, emissao, valorTotalCentavos: 0, pagamento: "", itens,
  importadoEm: "2026-11-05T10:00:00Z",
});
const item = (produtoId: string | undefined, unidade: "KG" | "UNID", preco: number, quantidade = 1) => ({
  codigo: "1", descricao: "X", produtoId, quantidade, unidade, valorUnitarioCentavos: preco, valorTotalCentavos: Math.round(preco * quantidade),
});

describe("variacaoPct", () => {
  it.each([
    [110, 100, 10],
    [90, 100, -10],
    [100, 100, 0],
    [150, 100, 50],
  ])("%d contra %d = %d%%", (a, b, v) => expect(variacaoPct(a, b)).toBeCloseTo(v));
  it("anterior zero devolve null", () => expect(variacaoPct(100, 0)).toBeNull());
});

describe("historicoPorProduto", () => {
  it("vazio", () => expect(historicoPorProduto([])).toEqual([]));

  it("ordena por data, calcula último, anterior, variação, menor e maior", () => {
    const h = historicoPorProduto([
      compra(2, "2026-11-04T10:00:00", mercadoB, [item(tomate, "KG", 648)]),
      compra(1, "2026-10-01T10:00:00", mercadoA, [item(tomate, "KG", 500)]),
      compra(3, "2026-10-20T10:00:00", mercadoA, [item(tomate, "KG", 700)]),
    ]);
    expect(h).toHaveLength(1);
    expect(h[0].pontos.map((p) => p.precoCentavos)).toEqual([500, 700, 648]);
    expect(h[0].ultimo).toMatchObject({ precoCentavos: 648, mercadoId: mercadoB });
    expect(h[0].anterior?.precoCentavos).toBe(700);
    expect(h[0].variacaoPct).toBeCloseTo(-7.43, 1);
    expect(h[0]).toMatchObject({ menorCentavos: 500, maiorCentavos: 700 });
  });

  it("uma única compra não tem anterior nem variação", () => {
    const [h] = historicoPorProduto([compra(1, "2026-10-01T10:00:00", mercadoA, [item(alho, "UNID", 231)])]);
    expect(h.anterior).toBeUndefined();
    expect(h.variacaoPct).toBeUndefined();
    expect(h.menorCentavos).toBe(231);
  });

  it("separa por unidade e ignora itens sem produto", () => {
    const h = historicoPorProduto([
      compra(1, "2026-10-01T10:00:00", mercadoA, [item(tomate, "KG", 500), item(tomate, "UNID", 100), item(undefined, "KG", 999)]),
    ]);
    expect(h).toHaveLength(2);
    expect(h.map((x) => x.unidade).sort()).toEqual(["KG", "UNID"]);
  });
});
