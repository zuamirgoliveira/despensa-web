import { describe, expect, it } from "vitest";
import { gastosPorMes, inflacaoPessoal, mesDe, serieDeInflacao } from "@/domain/gastos";
import type { Compra, Produto } from "@/domain/types";

const casaId = crypto.randomUUID();
const mercadoId = crypto.randomUUID();
const [TOMATE, ARROZ, LEITE] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const produtos: Pick<Produto, "id" | "categoria">[] = [
  { id: TOMATE, categoria: "hortifruti" }, { id: ARROZ, categoria: "mercearia" }, { id: LEITE, categoria: "laticinios" },
];
let n = 0;
type L = [string | undefined, string, number, number, ("KG" | "UNID")?]; // produto, descrição, quantidade, preço unitário
const compra = (data: string, itens: L[], custoIdaCentavos?: number): Compra => ({
  casaId, chave: String(++n).padStart(44, "0"), mercadoId, emissao: `${data}T10:00:00`, pagamento: "", importadoEm: "2026-11-05T10:00:00Z", custoIdaCentavos,
  valorTotalCentavos: itens.reduce((s, [, , q, p]) => s + Math.round(q * p), 0),
  itens: itens.map(([produtoId, descricao, quantidade, v, un], i) => ({
    codigo: String(i), descricao, produtoId, quantidade, unidade: un ?? "KG", valorUnitarioCentavos: v, valorTotalCentavos: Math.round(quantidade * v),
  })),
});

// 3 meses: agosto, setembro, outubro
const COMPRAS = [
  compra("2026-08-05", [[TOMATE, "TOMATE KG", 2, 500], [ARROZ, "ARROZ KG", 5, 600]], 1000),
  compra("2026-08-20", [[TOMATE, "TOMATE KG", 1, 500]], 1000),
  compra("2026-09-05", [[TOMATE, "TOMATE KG", 2, 550], [ARROZ, "ARROZ KG", 5, 660], [LEITE, "LEITE", 6, 500, "UNID"]], 800),
  compra("2026-10-05", [[TOMATE, "TOMATE KG", 3, 605], [ARROZ, "ARROZ KG", 5, 726], [undefined, "PILHA", 1, 1000, "UNID"]]),
];

describe("gastosPorMes", () => {
  const g = gastosPorMes(COMPRAS, produtos);

  it("meses do mais recente para o mais antigo", () => expect(g.map((x) => x.mes)).toEqual(["2026-10", "2026-09", "2026-08"]));

  it("totais por categoria, deslocamento e custo real conferem com o cálculo manual", () => {
    const ago = g[2];
    expect(ago.porCategoria).toEqual({ hortifruti: 1500, mercearia: 3000 }); // 2×500 + 1×500 ; 5×600
    expect(ago).toMatchObject({ itensCentavos: 4500, deslocamentoCentavos: 2000, custoRealCentavos: 6500, compras: 2 });
    const set = g[1];
    expect(set.porCategoria).toEqual({ hortifruti: 1100, mercearia: 3300, laticinios: 3000 });
    expect(set).toMatchObject({ itensCentavos: 7400, deslocamentoCentavos: 800, custoRealCentavos: 8200, compras: 1 });
  });

  it("item sem produto vai para 'outros'; compra sem custo de ida soma zero", () => {
    const out = g[0];
    expect(out.porCategoria.outros).toBe(1000);
    expect(out).toMatchObject({ deslocamentoCentavos: 0, custoRealCentavos: out.itensCentavos });
  });

  it("produto desconhecido do catálogo também vira 'outros'", () => {
    const r = gastosPorMes([compra("2026-11-01", [[crypto.randomUUID(), "X", 1, 100]])], produtos);
    expect(r[0].porCategoria).toEqual({ outros: 100 });
  });

  it("sem compras", () => expect(gastosPorMes([], produtos)).toEqual([]));
  it("mesDe", () => expect(mesDe("2026-11-04T10:00:00")).toBe("2026-11"));
});

describe("inflacaoPessoal (cesta fixa)", () => {
  it("setembro contra agosto: tomate +10% e arroz +10%; leite novo fica fora da cesta", () => {
    const r = inflacaoPessoal(COMPRAS, "2026-08", "2026-09");
    expect(r.itens).toBe(2);
    expect(r.variacaoPct).toBeCloseTo(10, 6);
  });

  it("comprar mais ou menos não distorce: só o preço conta", () => {
    // outubro: tomate 3 kg (antes 2) e preço +10% → continua +10% (a quantidade do mês base é que pesa)
    expect(inflacaoPessoal(COMPRAS, "2026-09", "2026-10").variacaoPct).toBeCloseTo(10, 6);
  });

  it("ponderada pelo gasto do mês base", () => {
    const c = [
      compra("2026-01-01", [[TOMATE, "T KG", 1, 1000], [ARROZ, "A KG", 1, 100]]),
      compra("2026-02-01", [[TOMATE, "T KG", 1, 1100], [ARROZ, "A KG", 1, 200]]), // tomate +10% (peso 1000), arroz +100% (peso 100)
    ];
    // (1000×1,1 + 100×2 − 1100) / 1100 = 200/1100 = 18,18%
    expect(inflacaoPessoal(c, "2026-01", "2026-02").variacaoPct).toBeCloseTo(18.1818, 3);
  });

  it("média dos preços do mês quando há mais de uma compra", () => {
    const c = [
      compra("2026-01-01", [[TOMATE, "T KG", 1, 100]]), compra("2026-01-15", [[TOMATE, "T KG", 1, 200]]), // média 150
      compra("2026-02-01", [[TOMATE, "T KG", 1, 300]]),
    ];
    expect(inflacaoPessoal(c, "2026-01", "2026-02").variacaoPct).toBeCloseTo(100, 6);
  });

  it("queda de preço dá variação negativa", () => {
    const c = [compra("2026-01-01", [[TOMATE, "T KG", 1, 1000]]), compra("2026-02-01", [[TOMATE, "T KG", 1, 900]])];
    expect(inflacaoPessoal(c, "2026-01", "2026-02").variacaoPct).toBeCloseTo(-10, 6);
  });

  it("embalagens diferentes (bases diferentes) não entram na mesma cesta", () => {
    const c = [compra("2026-01-01", [[ARROZ, "ARROZ", 1, 500, "UNID"]]), compra("2026-02-01", [[ARROZ, "ARROZ PCT 500G", 1, 450, "UNID"]])];
    expect(inflacaoPessoal(c, "2026-01", "2026-02")).toMatchObject({ itens: 0, variacaoPct: undefined });
  });

  it("sem produto comum ou mês sem compra: indefinido (e itens 0)", () => {
    expect(inflacaoPessoal(COMPRAS, "2026-08", "2026-07")).toMatchObject({ itens: 0, variacaoPct: undefined });
    expect(inflacaoPessoal([], "2026-08", "2026-09").variacaoPct).toBeUndefined();
  });
});

describe("serieDeInflacao", () => {
  it("mês a mês, do mais antigo ao mais novo", () => {
    const s = serieDeInflacao(COMPRAS);
    expect(s.map((x) => `${x.de}→${x.para}`)).toEqual(["2026-08→2026-09", "2026-09→2026-10"]);
    expect(s.every((x) => Math.abs((x.variacaoPct ?? 0) - 10) < 1e-6)).toBe(true);
  });
  it("um só mês ou nenhum: série vazia", () => {
    expect(serieDeInflacao([COMPRAS[0]])).toEqual([]);
    expect(serieDeInflacao([])).toEqual([]);
  });
});
