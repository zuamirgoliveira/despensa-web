import { describe, expect, it } from "vitest";
import { compraResolvida, estadoDoOrcamento, foiNaoPego, ordenarParaCompra, ordenarSecoes, progressoDaCompra, quantidadeDoItem, totalCorrente } from "@/domain/compra";
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
  it("pendentes, depois pegos, e por último os não peguei, mantendo a ordem original", () => {
    const [a, b, c, d, e] = [item({ status: "pego" }), item({ status: "pendente" }), item({ status: "adiado" }), item({ status: "pendente" }), item({ status: "extra" })];
    const r = ordenarParaCompra([a, b, c, d, e].map((i) => ({ item: i })));
    expect(r.map((x) => x.item.id)).toEqual([b.id, d.id, a.id, e.id, c.id]);
  });
  it("não encontrado fica abaixo dos pegos", () => {
    const [nao, pego] = [item({ status: "nao_encontrado" }), item({ status: "pego" })];
    expect(ordenarParaCompra([nao, pego].map((i) => ({ item: i }))).map((x) => x.item.id)).toEqual([pego.id, nao.id]);
  });
  it("vazio", () => expect(ordenarParaCompra([])).toEqual([]));
});

describe("ordenarSecoes", () => {
  const sec = (nome: string, ...status: ItemLista["status"][]) => ({ nome, itens: status.map((s) => ({ item: item({ status: s }) })) });
  it("com pendente primeiro; concluídas só com pegos; concluídas com não peguei por último; ordem estável", () => {
    const grupos = [sec("Hortifruti", "pego", "pego"), sec("Mercearia", "pendente"), sec("Limpeza", "pego", "nao_encontrado"), sec("Bebidas", "pego", "pendente"), sec("Carnes", "pego")];
    expect(ordenarSecoes(grupos).map((g) => g.nome)).toEqual(["Mercearia", "Bebidas", "Hortifruti", "Carnes", "Limpeza"]);
  });
  it("extra conta como pego; vazio", () => {
    expect(ordenarSecoes([sec("A", "extra"), sec("B", "pendente")]).map((g) => g.nome)).toEqual(["B", "A"]);
    expect(ordenarSecoes([])).toEqual([]);
  });
});

describe("compraResolvida / foiNaoPego", () => {
  it("só quando há itens e nenhum pendente (removidos não contam)", () => {
    expect(compraResolvida([])).toBe(false);
    expect(compraResolvida([item({ status: "pego" }), item({ status: "nao_encontrado" })])).toBe(true);
    expect(compraResolvida([item({ status: "pego" }), item({ status: "pendente" })])).toBe(false);
    expect(compraResolvida([item({ status: "pego" }), item({ status: "pendente", removido: true })])).toBe(true);
  });
  it("adiado vale como não peguei", () => {
    expect(foiNaoPego({ status: "adiado" })).toBe(true);
    expect(foiNaoPego({ status: "nao_encontrado" })).toBe(true);
    expect(foiNaoPego({ status: "pego" })).toBe(false);
  });
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
