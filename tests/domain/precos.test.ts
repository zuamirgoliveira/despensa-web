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

import { historicoDoProduto, mediaDoUsuario, precoNormalizado } from "@/domain/precos";

describe("precoNormalizado", () => {
  const n = (descricao: string, unidade: "KG" | "UNID" | "L" | "PCT", v: number) => precoNormalizado({ descricao, unidade, valorUnitarioCentavos: v });
  it.each([
    ["TOMATE KG", "KG", 898, { centavos: 898, base: "kg" }],
    ["LEITE", "L", 450, { centavos: 450, base: "l" }],
    ["COENTRO UN", "UNID", 288, { centavos: 288, base: "un" }],
    ["ALHO REDINHA PCT 180", "UNID", 648, { centavos: 360, base: "100g" }], // pacote de 180 g a R$ 6,48 → R$ 3,60/100 g
    ["CAFE PCT 500G", "UNID", 2000, { centavos: 400, base: "100g" }],
    ["ACUCAR 2KG", "UNID", 1000, { centavos: 50, base: "100g" }],
    ["LEITE UHT 1L", "UNID", 500, { centavos: 50, base: "100ml" }],
    ["IOGURTE 170 ML", "UNID", 340, { centavos: 200, base: "100ml" }],
    ["OVOS CX 12", "UNID", 1200, { centavos: 100, base: "un" }],
    ["BISCOITO PCT", "PCT", 350, { centavos: 350, base: "un" }],
  ] as const)("%s", (d, u, v, esperado) => expect(n(d, u, v)).toEqual(esperado));

  it("embalagens diferentes do mesmo produto ficam comparáveis", () => {
    const pequeno = n("CAFE PCT 250G", "UNID", 1100); // R$ 4,40/100 g
    const grande = n("CAFE PCT 500G", "UNID", 2000); // R$ 4,00/100 g
    expect(pequeno.base).toBe(grande.base);
    expect(grande.centavos).toBeLessThan(pequeno.centavos);
  });
});

describe("mediaDoUsuario e histórico normalizado", () => {
  const casa = crypto.randomUUID();
  const prod = crypto.randomUUID();
  const comp = (data: string, descricao: string, v: number): Compra => ({
    casaId: casa, chave: Math.random().toString().slice(2).padEnd(44, "0").slice(0, 44), mercadoId: crypto.randomUUID(), emissao: `${data}T10:00:00`,
    valorTotalCentavos: v, pagamento: "", importadoEm: "2026-11-05T10:00:00Z",
    itens: [{ codigo: "1", descricao, produtoId: prod, quantidade: 1, unidade: "UNID", valorUnitarioCentavos: v, valorTotalCentavos: v }],
  });

  it("pacote de 180 g e de 500 g entram no mesmo histórico, em R$/100 g", () => {
    const [h] = historicoDoProduto([comp("2026-10-01", "CAFE PCT 250G", 1100), comp("2026-11-01", "CAFE PCT 500G", 2000)], prod);
    expect(h.base).toBe("100g");
    expect(h.pontos.map((p) => p.normalizadoCentavos)).toEqual([440, 400]);
    expect(h.variacaoPct).toBeCloseTo(-9.09, 1);
    expect(h).toMatchObject({ menorCentavos: 400, maiorCentavos: 440, mediaCentavos: 420 });
  });

  it("bases diferentes não se misturam", () => {
    expect(historicoDoProduto([comp("2026-10-01", "CAFE PCT 250G", 1100), comp("2026-11-01", "CAFE", 900)], prod)).toHaveLength(2);
  });

  it("média com janela de dias", () => {
    const [h] = historicoDoProduto([comp("2026-08-01", "X", 100), comp("2026-10-20", "X", 200), comp("2026-11-01", "X", 400)], prod);
    expect(mediaDoUsuario(h.pontos)).toBe(233.33);
    expect(mediaDoUsuario(h.pontos, { hoje: "2026-11-05", dias: 30 })).toBe(300);
    expect(mediaDoUsuario(h.pontos, { hoje: "2026-11-05", dias: 1 })).toBeUndefined();
    expect(mediaDoUsuario([])).toBeUndefined();
  });

  it("produto sem compras", () => expect(historicoDoProduto([], prod)).toEqual([]));
});

import { alertaDePreco, alertasPorProduto } from "@/domain/precos";

describe("alertaDePreco", () => {
  const casa = crypto.randomUUID();
  const prod = crypto.randomUUID();
  let n = 0;
  const comp = (data: string, v: number, produtoId = prod): Compra => ({
    casaId: casa, chave: String(++n).padStart(44, "0"), mercadoId: crypto.randomUUID(), emissao: `${data}T10:00:00`, valorTotalCentavos: v, pagamento: "", importadoEm: "2026-11-05T10:00:00Z",
    itens: [{ codigo: "1", descricao: "TOMATE KG", produtoId, quantidade: 1, unidade: "KG", valorUnitarioCentavos: v, valorTotalCentavos: v }],
  });
  const h = (...precos: number[]) => historicoDoProduto(precos.map((v, i) => comp(`2026-10-${String(i + 1).padStart(2, "0")}`, v)), prod)[0];

  it("2 compras não geram alerta, mesmo com salto grande", () => expect(alertaDePreco(h(100, 300), 20)).toBeUndefined());
  it("3 compras com o último 25% acima da média anterior geram", () => {
    expect(alertaDePreco(h(100, 100, 125), 20)).toEqual({ tipo: "acima", pct: 25 });
  });
  it("a média usa as compras anteriores, não o último preço", () => expect(alertaDePreco(h(80, 120, 150), 20)?.pct).toBe(50));
  it("exatamente no limiar não alerta; um pouco acima sim", () => {
    expect(alertaDePreco(h(100, 100, 120), 20)).toBeUndefined();
    expect(alertaDePreco(h(100, 100, 121), 20)).toMatchObject({ tipo: "acima" });
  });
  it("limiar editado muda o resultado", () => {
    expect(alertaDePreco(h(100, 100, 125), 30)).toBeUndefined();
    expect(alertaDePreco(h(100, 100, 125), 10)).toMatchObject({ pct: 25 });
  });
  it("preço muito abaixo da média vira aviso discreto 'abaixo'", () => {
    expect(alertaDePreco(h(100, 100, 70), 20)).toEqual({ tipo: "abaixo", pct: 30 });
    expect(alertaDePreco(h(100, 100, 90), 20)).toBeUndefined();
  });
  it("média anterior zero não quebra", () => expect(alertaDePreco(h(0, 0, 50), 20)).toBeUndefined());

  it("alertasPorProduto: só os produtos com alerta", () => {
    const outro = crypto.randomUUID();
    const compras = [
      comp("2026-10-01", 100), comp("2026-10-02", 100), comp("2026-10-03", 150),
      comp("2026-10-01", 100, outro), comp("2026-10-02", 100, outro),
    ];
    const m = alertasPorProduto(compras, 20);
    expect([...m.keys()]).toEqual([prod]);
    expect(m.get(prod)).toEqual({ tipo: "acima", pct: 50 });
  });
});
