import { describe, expect, it } from "vitest";
import { estadoDoOrcamento, ordenarParaCompra, progressoDaCompra, quantidadeDoItem, totalCorrente } from "@/domain/compra";
import type { ItemLista } from "@/domain/types";

const casaId = crypto.randomUUID();
const item = (extra: Partial<ItemLista> = {}): ItemLista => ({
  id: crypto.randomUUID(), casaId, listaId: "l", produtoId: crypto.randomUUID(), quantidadeSugerida: 2, status: "pendente",
  urgente: false, removido: false, quantidadeEditada: false, ...extra,
});

describe("quantidadeDoItem", () => {
  it("usa a quantidade pega, senão a sugerida (inclusive quando a pega é 0)", () => {
    expect(quantidadeDoItem({ quantidadeSugerida: 2 })).toBe(2);
    expect(quantidadeDoItem({ quantidadeSugerida: 2, quantidadePega: 3.5 })).toBe(3.5);
    expect(quantidadeDoItem({ quantidadeSugerida: 2, quantidadePega: 0 })).toBe(0);
  });
});

describe("totalCorrente", () => {
  it("soma só itens pegos ou extras com preço, usando a quantidade pega", () => {
    const itens = [
      item({ status: "pego", quantidadePega: 1.5, precoCentavos: 800 }), // 1200
      item({ status: "extra", quantidadeSugerida: 2, precoCentavos: 250 }), // 500
      item({ status: "pego", precoCentavos: 100 }), // sugerida 2 → 200
      item({ status: "pendente", precoCentavos: 999 }),
      item({ status: "nao_encontrado", precoCentavos: 999 }),
      item({ status: "adiado", precoCentavos: 999 }),
      item({ status: "pego", removido: true, precoCentavos: 999 }),
      item({ status: "pego" }), // sem preço: fora
    ];
    expect(totalCorrente(itens)).toBe(1900);
  });
  it("arredonda ao centavo e aceita lista vazia", () => {
    expect(totalCorrente([item({ status: "pego", quantidadePega: 0.333, precoCentavos: 100 })])).toBe(33);
    expect(totalCorrente([])).toBe(0);
  });
});

describe("progressoDaCompra", () => {
  it("pegos e extras sobre os itens ativos", () => {
    const itens = [item({ status: "pego" }), item({ status: "extra" }), item({ status: "pendente" }), item({ status: "nao_encontrado" }), item({ removido: true, status: "pego" })];
    expect(progressoDaCompra(itens)).toEqual({ pegos: 2, total: 4 });
    expect(progressoDaCompra([])).toEqual({ pegos: 0, total: 0 });
  });
});

describe("ordenarParaCompra", () => {
  it("pendentes, depois não encontrados/adiados, e pegos no fim, mantendo a ordem original", () => {
    const [a, b, c, d, e] = [item({ status: "pego" }), item({ status: "pendente" }), item({ status: "adiado" }), item({ status: "pendente" }), item({ status: "extra" })];
    const r = ordenarParaCompra([a, b, c, d, e].map((i) => ({ item: i })));
    expect(r.map((x) => x.item.id)).toEqual([b.id, d.id, c.id, a.id, e.id]);
  });
  it("vazio", () => expect(ordenarParaCompra([])).toEqual([]));
});

describe("estadoDoOrcamento", () => {
  it.each([
    [500, undefined, "sem_orcamento"],
    [500, 0, "sem_orcamento"],
    [0, 1000, "dentro"],
    [899, 1000, "dentro"],
    [900, 1000, "perto"],
    [1000, 1000, "perto"],
    [1001, 1000, "estourou"],
  ] as const)("total %s orçamento %s → %s", (total, orc, esperado) => expect(estadoDoOrcamento(total, orc)).toBe(esperado));
});
