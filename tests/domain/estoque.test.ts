import { describe, expect, it } from "vitest";
import {
  aplicarCompra,
  comprasDoProduto,
  consumoDiario,
  coberturaDias,
  estoqueAgora,
  estoqueEstimado,
  estoqueNaData,
  fracaoDoNivel,
  sugerirProvavelmenteAcabando,
  quantidadeReferencia,
} from "@/domain/estoque";
import type { Compra, Estoque, Produto } from "@/domain/types";

const casaId = crypto.randomUUID();
const P = crypto.randomUUID();
const OUTRO = crypto.randomUUID();

const produto = (extra: Partial<Produto> = {}): Pick<Produto, "id" | "meta" | "frequencia"> => ({
  id: P, meta: 7, frequencia: "semanal", ...extra,
});

let seq = 0;
const compra = (data: string, itens: [string, number][]): Compra => ({
  casaId, chave: String(++seq).padStart(44, "0"), mercadoId: crypto.randomUUID(), emissao: `${data}T10:00:00`,
  valorTotalCentavos: 0, pagamento: "", importadoEm: "2026-11-05T10:00:00Z",
  itens: itens.map(([produtoId, quantidade], i) => ({
    codigo: String(i), descricao: "X", produtoId, quantidade, unidade: "KG" as const, valorUnitarioCentavos: 100, valorTotalCentavos: 100,
  })),
});
const doProduto = (...pares: [string, number][]) => pares.map(([d, q]) => compra(d, [[P, q]]));

describe("fracaoDoNivel / estoqueEstimado", () => {
  it.each([
    ["cheio", 1, 10],
    ["metade", 0.5, 5],
    ["acabando", 0.2, 2],
    ["acabou", 0, 0],
  ] as const)("%s", (nivel, fracao, estoque) => {
    expect(fracaoDoNivel(nivel)).toBe(fracao);
    expect(estoqueEstimado(nivel, 10)).toBe(estoque);
  });
  it("referência zero", () => expect(estoqueEstimado("cheio", 0)).toBe(0));
});

describe("comprasDoProduto", () => {
  it("soma itens do mesmo produto na mesma nota, ordena por data e ignora outros produtos", () => {
    const l = comprasDoProduto(P, [
      compra("2026-10-10", [[P, 1], [P, 2], [OUTRO, 9]]),
      compra("2026-10-01", [[P, 4]]),
      compra("2026-10-05", [[OUTRO, 3]]),
    ]);
    expect(l).toEqual([{ data: "2026-10-01", quantidade: 4 }, { data: "2026-10-10", quantidade: 3 }]);
  });
  it("sem compras", () => expect(comprasDoProduto(P, [])).toEqual([]));
});

describe("quantidadeReferencia", () => {
  it("usa a meta quando positiva", () => expect(quantidadeReferencia({ id: P, meta: 3 }, doProduto(["2026-10-01", 9]))).toBe(3));
  it("sem meta usa a última quantidade comprada", () => {
    expect(quantidadeReferencia({ id: P, meta: 0 }, doProduto(["2026-10-01", 2], ["2026-10-20", 5]))).toBe(5);
  });
  it("sem meta e sem compra: 0", () => expect(quantidadeReferencia({ id: P, meta: 0 }, [])).toBe(0));
});

describe("consumoDiario", () => {
  it("0 compras: frequência declarada", () => {
    expect(consumoDiario(produto({ frequencia: "semanal", meta: 7 }), [])).toBe(1);
    expect(consumoDiario(produto({ frequencia: "quinzenal", meta: 15 }), [])).toBe(1);
    expect(consumoDiario(produto({ frequencia: "mensal", meta: 30 }), [])).toBe(1);
    expect(consumoDiario(produto({ frequencia: "mensal", meta: 3 }), [])).toBeCloseTo(0.1);
  });

  it("sob demanda sem histórico: indefinido", () => {
    expect(consumoDiario(produto({ frequencia: "sob_demanda" }), [])).toBeUndefined();
  });

  it("1 compra ainda usa a frequência declarada", () => {
    expect(consumoDiario(produto({ meta: 14, frequencia: "semanal" }), doProduto(["2026-10-01", 99]))).toBe(2);
  });

  it("2 compras: quantidade da primeira ÷ dias até a segunda", () => {
    expect(consumoDiario(produto(), doProduto(["2026-10-01", 7], ["2026-10-08", 7]))).toBe(1);
    expect(consumoDiario(produto(), doProduto(["2026-10-01", 2], ["2026-10-11", 9]))).toBeCloseTo(0.2);
  });

  it("5 compras: média só das últimas 4 razões", () => {
    // razões: 1/1=1, 2/1=2, 3/1=3, 4/1=4, (a 5ª compra não tem razão própria) → compras: 1,2,3,4,5 em dias seguidos
    const c = doProduto(["2026-10-01", 1], ["2026-10-02", 2], ["2026-10-03", 3], ["2026-10-04", 4], ["2026-10-05", 5]);
    expect(consumoDiario(produto(), c)).toBe(2.5); // razões 1,2,3,4 → média 2,5
    const seis = [...c, ...doProduto(["2026-10-06", 6])];
    expect(consumoDiario(produto(), seis)).toBe(3.5); // últimas 4: 2,3,4,5
  });

  it("ignora intervalos de 0 dia (duas compras no mesmo dia)", () => {
    const c = doProduto(["2026-10-01", 5], ["2026-10-01", 5], ["2026-10-11", 10]);
    // as duas do dia 01 viram duas entradas: razões 0 dia (ignorada) e 5/10
    expect(consumoDiario(produto(), c)).toBeCloseTo(0.5);
  });

  it("só intervalos de 0 dia: cai para a frequência declarada", () => {
    const c = doProduto(["2026-10-01", 5], ["2026-10-01", 5]);
    expect(consumoDiario(produto({ meta: 14 }), c)).toBe(2);
    expect(consumoDiario(produto({ frequencia: "sob_demanda" }), c)).toBeUndefined();
  });

  it("sob demanda com 2 compras usa o histórico", () => {
    const c = doProduto(["2026-10-01", 6], ["2026-10-07", 6]);
    expect(consumoDiario(produto({ frequencia: "sob_demanda" }), c)).toBe(1);
  });

  it("virada de mês e ano bissexto contam dias civis", () => {
    const c = doProduto(["2028-02-01", 29], ["2028-03-01", 29]); // fevereiro de 2028 tem 29 dias
    expect(consumoDiario(produto(), c)).toBe(1);
  });
});

describe("coberturaDias", () => {
  it.each([
    [10, 2, 5],
    [0, 2, 0],
    [5, 0, Infinity],
    [5, undefined, Infinity],
    [0, 0, Infinity],
    [5, -1, Infinity],
  ])("estoque %s consumo %s → %s", (e, c, esperado) => expect(coberturaDias(e, c)).toBe(esperado));
});

describe("estoqueNaData", () => {
  it.each([
    [10, 2, 3, 4],
    [10, 2, 5, 0],
    [10, 2, 9, 0], // nunca negativo
    [10, 2, 0, 10],
    [10, undefined, 30, 10],
    [0, 1, 1, 0],
  ])("agora %s consumo %s dias %s → %s", (e, c, d, esperado) => expect(estoqueNaData(e, c, d)).toBe(esperado));
});

describe("estoqueAgora", () => {
  it("desconta o consumo desde a confirmação", () => {
    expect(estoqueAgora("cheio", 7, 1, "2026-11-01T10:00:00-03:00", "2026-11-04")).toBe(4);
  });
  it("confirmação no futuro não aumenta o estoque", () => {
    expect(estoqueAgora("metade", 10, 1, "2026-11-10T10:00:00Z", "2026-11-04")).toBe(5);
  });
  it("esgota", () => expect(estoqueAgora("metade", 10, 1, "2026-10-01T10:00:00Z", "2026-11-04")).toBe(0));
});

describe("aplicarCompra", () => {
  const ids = () => {
    let n = 0;
    return () => `id-${++n}`;
  };
  const est = (produtoId: string, nivel: Estoque["nivel"], extra: Partial<Estoque> = {}): Estoque => ({
    id: crypto.randomUUID(), casaId, produtoId, quantidade: fracaoDoNivel(nivel), nivel, confirmadoEm: "2026-10-01T10:00:00Z", ...extra,
  });

  it("atualiza o existente para cheio e cria os que não existem", () => {
    const existente = est(P, "acabou", { quantidadeExata: 0 });
    const r = aplicarCompra([existente], compra("2026-11-04", [[P, 1], [OUTRO, 2]]), "2026-11-04T10:00:00Z", ids());
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ id: existente.id, produtoId: P, nivel: "cheio", confirmadoEm: "2026-11-04T10:00:00Z" });
    expect(r[0].quantidadeExata).toBeUndefined();
    expect(r[1]).toMatchObject({ id: "id-1", casaId, produtoId: OUTRO, nivel: "cheio" });
  });

  it("produto repetido na nota gera um só registro; item sem produto é ignorado", () => {
    const c = compra("2026-11-04", [[P, 1], [P, 2]]);
    c.itens.push({ ...c.itens[0], produtoId: undefined });
    expect(aplicarCompra([], c, "2026-11-04T10:00:00Z", ids())).toHaveLength(1);
  });

  it("não altera os registros de entrada", () => {
    const existente = est(P, "metade");
    aplicarCompra([existente], compra("2026-11-04", [[P, 1]]), "2026-11-04T10:00:00Z", ids());
    expect(existente.nivel).toBe("metade");
  });

  it("compra vazia", () => expect(aplicarCompra([], { casaId, itens: [] }, "x", ids())).toEqual([]));
});

describe("sugerirProvavelmenteAcabando", () => {
  const p = produto({ meta: 7, frequencia: "semanal" }); // consumo 1/dia
  const e = (nivel: Estoque["nivel"], confirmadoEm: string) => ({ nivel, confirmadoEm });

  it("cobertura menor que 2 dias com nível ainda cheio/metade: pede confirmação", () => {
    // cheio = 7, confirmado há 6 dias → resta 1 → cobertura 1 < 2
    expect(sugerirProvavelmenteAcabando(p, e("cheio", "2026-10-29T10:00:00Z"), [], "2026-11-04")).toBe(true);
  });
  it("cobertura de exatamente 2 dias não pede", () => {
    expect(sugerirProvavelmenteAcabando(p, e("cheio", "2026-10-30T10:00:00Z"), [], "2026-11-04")).toBe(false); // resta 2
  });
  it("cobertura boa não pede", () => {
    expect(sugerirProvavelmenteAcabando(p, e("cheio", "2026-11-04T10:00:00Z"), [], "2026-11-04")).toBe(false);
  });
  it("já marcado como acabando ou acabou não pede", () => {
    expect(sugerirProvavelmenteAcabando(p, e("acabando", "2026-10-01T10:00:00Z"), [], "2026-11-04")).toBe(false);
    expect(sugerirProvavelmenteAcabando(p, e("acabou", "2026-10-01T10:00:00Z"), [], "2026-11-04")).toBe(false);
  });
  it("consumo desconhecido (sob demanda) nunca pede", () => {
    expect(sugerirProvavelmenteAcabando(produto({ frequencia: "sob_demanda" }), e("cheio", "2026-01-01T10:00:00Z"), [], "2026-11-04")).toBe(false);
  });
  it("usa o consumo do histórico de compras", () => {
    // 2 compras: 6 un em 3 dias → 2/dia; meta 7 → cheio = 7; passados 3 dias → resta 1 → cobertura 0,5
    const c = doProduto(["2026-10-01", 6], ["2026-10-04", 6]);
    expect(sugerirProvavelmenteAcabando(p, e("cheio", "2026-11-01T10:00:00Z"), c, "2026-11-04")).toBe(true);
  });
});
