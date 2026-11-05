import { describe, expect, it } from "vitest";
import { custoDaCesta, melhorMercadoPorProduto, sugerirMercadoPreferido } from "@/domain/comparacao";
import type { Compra } from "@/domain/types";

const casaId = crypto.randomUUID();
const [A, B, C] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const [P1, P2] = [crypto.randomUUID(), crypto.randomUUID()];
let n = 0;
const compra = (data: string, mercadoId: string, itens: [string, string, number][]): Compra => ({
  casaId, chave: String(++n).padStart(44, "0"), mercadoId, emissao: `${data}T10:00:00`, valorTotalCentavos: 0, pagamento: "", importadoEm: "2026-11-05T10:00:00Z",
  itens: itens.map(([produtoId, descricao, v], i) => ({ codigo: String(i), descricao, produtoId, quantidade: 1, unidade: (descricao.includes("PCT") ? "UNID" : "KG") as "KG" | "UNID", valorUnitarioCentavos: v, valorTotalCentavos: v })),
});
const HOJE = "2026-11-08";

describe("melhorMercadoPorProduto", () => {
  it("2 mercados: o mais barato vence, lista em ordem crescente", () => {
    const m = melhorMercadoPorProduto([compra("2026-11-01", A, [[P1, "TOMATE KG", 500]]), compra("2026-11-02", B, [[P1, "TOMATE KG", 400]])], HOJE);
    const c = m.get(P1)!;
    expect(c.melhorMercadoId).toBe(B);
    expect(c.mercados.map((x) => x.normalizadoCentavos)).toEqual([400, 500]);
    expect(c.empate).toBe(false);
    expect(c.base).toBe("kg");
  });

  it("3 mercados", () => {
    const m = melhorMercadoPorProduto([compra("2026-11-01", A, [[P1, "X KG", 500]]), compra("2026-11-02", B, [[P1, "X KG", 450]]), compra("2026-11-03", C, [[P1, "X KG", 480]])], HOJE);
    expect(m.get(P1)?.mercados.map((x) => x.mercadoId)).toEqual([B, C, A]);
  });

  it("usa o preço mais recente de cada mercado", () => {
    const m = melhorMercadoPorProduto([compra("2026-10-20", A, [[P1, "X KG", 300]]), compra("2026-11-05", A, [[P1, "X KG", 600]]), compra("2026-11-01", B, [[P1, "X KG", 500]])], HOJE);
    expect(m.get(P1)?.melhorMercadoId).toBe(B);
    expect(m.get(P1)?.mercados.find((x) => x.mercadoId === A)?.normalizadoCentavos).toBe(600);
  });

  it("janela de tempo: compra fora da janela é ignorada (limite de 60 dias inclusive)", () => {
    const fora = compra("2026-09-08", A, [[P1, "X KG", 100]]); // 61 dias antes de 08/11
    const dentro = compra("2026-09-09", B, [[P1, "X KG", 900]]); // 60 dias
    const m = melhorMercadoPorProduto([fora, dentro], HOJE);
    expect(m.get(P1)?.mercados.map((x) => x.mercadoId)).toEqual([B]);
    expect(melhorMercadoPorProduto([fora, dentro], HOJE, 90).get(P1)?.melhorMercadoId).toBe(A);
  });

  it("empate no menor preço", () => {
    const m = melhorMercadoPorProduto([compra("2026-11-01", A, [[P1, "X KG", 500]]), compra("2026-11-02", B, [[P1, "X KG", 500]])], HOJE);
    expect(m.get(P1)?.empate).toBe(true);
  });

  it("compara pelo preço normalizado: pacote grande mais barato por 100 g vence", () => {
    const m = melhorMercadoPorProduto([compra("2026-11-01", A, [[P1, "CAFE PCT 250G", 1100]]), compra("2026-11-02", B, [[P1, "CAFE PCT 500G", 2000]])], HOJE);
    expect(m.get(P1)).toMatchObject({ melhorMercadoId: B, base: "100g" });
  });

  it("produto vendido em um só mercado e item sem produto", () => {
    const c = compra("2026-11-01", A, [[P1, "X KG", 500]]);
    c.itens.push({ ...c.itens[0], produtoId: undefined });
    const m = melhorMercadoPorProduto([c], HOJE);
    expect(m.size).toBe(1);
    expect(m.get(P1)?.mercados).toHaveLength(1);
  });

  it("sem compras", () => expect(melhorMercadoPorProduto([], HOJE).size).toBe(0));
});

describe("custoDaCesta", () => {
  const produtos = [
    { id: P1, meta: 2, ativo: true },
    { id: P2, meta: 1.5, ativo: true },
    { id: crypto.randomUUID(), meta: 3, ativo: true }, // sem preço em lugar nenhum
    { id: crypto.randomUUID(), meta: 0, ativo: true }, // sem meta: fora da cesta
    { id: crypto.randomUUID(), meta: 5, ativo: false }, // arquivado: fora da cesta
  ];
  const comp = melhorMercadoPorProduto(
    [compra("2026-11-01", A, [[P1, "X KG", 500], [P2, "Y KG", 1000]]), compra("2026-11-02", B, [[P1, "X KG", 400]])],
    HOJE,
  );

  it("soma meta × preço e informa a cobertura (N de M itens)", () => {
    expect(custoDaCesta(produtos, A, comp)).toEqual({ mercadoId: A, totalCentavos: 2 * 500 + 1.5 * 1000, cobertos: 2, totalItens: 3 });
    expect(custoDaCesta(produtos, B, comp)).toEqual({ mercadoId: B, totalCentavos: 800, cobertos: 1, totalItens: 3 });
  });
  it("mercado sem nenhum preço", () => expect(custoDaCesta(produtos, C, comp)).toMatchObject({ totalCentavos: 0, cobertos: 0, totalItens: 3 }));
  it("sem produtos", () => expect(custoDaCesta([], A, comp)).toEqual({ mercadoId: A, totalCentavos: 0, cobertos: 0, totalItens: 0 }));
});

describe("sugerirMercadoPreferido", () => {
  const comp = (precoA: number, precoB: number, precoC?: number) =>
    melhorMercadoPorProduto(
      [compra("2026-11-01", A, [[P1, "X KG", precoA]]), compra("2026-11-02", B, [[P1, "X KG", precoB]]), ...(precoC ? [compra("2026-11-03", C, [[P1, "X KG", precoC]])] : [])],
      HOJE,
    );

  it("sem preferido: sugere o mais barato quando a economia passa de 10% sobre a média dos outros", () => {
    expect(sugerirMercadoPreferido({ id: P1 }, comp(500, 400))).toEqual({ mercadoId: B, economiaPct: 20 });
  });
  it("preferido já é o melhor: nada a sugerir", () => expect(sugerirMercadoPreferido({ id: P1, mercadoPreferidoId: B }, comp(500, 400))).toBeUndefined());
  it("preferido mais caro: economia é contra o preferido", () => {
    expect(sugerirMercadoPreferido({ id: P1, mercadoPreferidoId: A }, comp(500, 400, 450))).toEqual({ mercadoId: B, economiaPct: 20 });
  });
  it("diferença pequena (≤ 10%) não sugere; limiar editável", () => {
    expect(sugerirMercadoPreferido({ id: P1 }, comp(500, 450))).toBeUndefined(); // exatamente 10%
    expect(sugerirMercadoPreferido({ id: P1 }, comp(500, 460))).toBeUndefined();
    expect(sugerirMercadoPreferido({ id: P1 }, comp(500, 460), 5)).toMatchObject({ mercadoId: B });
  });
  it("um só mercado, empate e produto desconhecido não sugerem", () => {
    expect(sugerirMercadoPreferido({ id: P1 }, melhorMercadoPorProduto([compra("2026-11-01", A, [[P1, "X KG", 500]])], HOJE))).toBeUndefined();
    expect(sugerirMercadoPreferido({ id: P1 }, comp(500, 500))).toBeUndefined();
    expect(sugerirMercadoPreferido({ id: crypto.randomUUID() }, comp(500, 400))).toBeUndefined();
  });
});
