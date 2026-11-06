import { describe, expect, it } from "vitest";
import { melhorMercadoPorProduto } from "@/domain/comparacao";
import { avisoIdaPoucoVantajosa, economiaLiquida, mercadoHabitual, proporDivisao } from "@/domain/economia";
import type { Compra, Mercado } from "@/domain/types";

const casaId = crypto.randomUUID();
const mercado = (extra: Partial<Mercado> = {}): Mercado => ({
  id: crypto.randomUUID(), casaId, cnpj: "08868231000638", nome: "M", endereco: "", tipo: "supermercado", transporte: "carro", ...extra,
});
const perfil = { carro: { consumoKmPorLitro: 10, precoCombustivelCentavos: 600, desgasteCentavosPorKm: 30 }, bikeCentavosPorKm: 5, economiaMinimaDivisaoCentavos: 500 };
const [P1, P2, P3] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
let n = 0;
const compra = (data: string, mercadoId: string, itens: [string, number][]): Compra => ({
  casaId, chave: String(++n).padStart(44, "0"), mercadoId, emissao: `${data}T10:00:00`, valorTotalCentavos: 0, pagamento: "", importadoEm: "2026-11-05T10:00:00Z",
  itens: itens.map(([produtoId, v], i) => ({ codigo: String(i), descricao: "X KG", produtoId, quantidade: 1, unidade: "KG" as const, valorUnitarioCentavos: v, valorTotalCentavos: v })),
});
const item = (produtoId: string, q: number) => ({ produtoId, quantidadeSugerida: q, removido: false });

describe("economiaLiquida", () => {
  it.each([[1000, 400, 600], [400, 1000, -600], [500, 500, 0]])("%d − %d = %d", (e, c, r) => expect(economiaLiquida(e, c)).toBe(r));
});

describe("mercadoHabitual", () => {
  it("o da agenda; senão o mais usado", () => {
    const m1 = crypto.randomUUID();
    const m2 = crypto.randomUUID();
    expect(mercadoHabitual([{ tipo: "mercado_semanal", mercadoId: m1 }], "mercado_semanal", [{ mercadoId: m2 }])).toBe(m1);
    expect(mercadoHabitual([{ tipo: "mercado_semanal" }], "mercado_semanal", [{ mercadoId: m1 }, { mercadoId: m2 }, { mercadoId: m2 }])).toBe(m2);
    expect(mercadoHabitual([], "mercado_semanal", [])).toBeUndefined();
  });
});

describe("proporDivisao", () => {
  const A = mercado({ distanciaKm: 3 });
  const comp = (precosA: number[], precosB: number[], B: Mercado) =>
    melhorMercadoPorProduto(
      [compra("2026-11-01", A.id, [[P1, precosA[0]], [P2, precosA[1]], [P3, precosA[2]]]), compra("2026-11-02", B.id, [[P1, precosB[0]], [P2, precosB[1]], [P3, precosB[2]]])],
      "2026-11-08",
    );
  const itens = [item(P1, 2), item(P2, 3), item(P3, 1)];

  it("economia menor que a ida extra: não propõe", () => {
    const B = mercado({ distanciaKm: 10 }); // ida: 20 km × R$ 0,90 = R$ 18,00
    expect(proporDivisao({ itens, habitualId: A.id, mercados: [A, B], comparacoes: comp([1000, 1000, 1000], [900, 900, 900], B), perfil })).toBeUndefined(); // economiza 10% de R$ 60 = R$ 6
  });

  it("economia maior que a ida: propõe, com os itens que ficam mais baratos lá", () => {
    const B = mercado({ distanciaKm: 2 }); // 4 km × 0,90 = R$ 3,60
    const p = proporDivisao({ itens, habitualId: A.id, mercados: [A, B], comparacoes: comp([1000, 1000, 1000], [500, 1100, 800], B), perfil })!;
    // P1: 2 × 1000 × 50% = 1000; P3: 1 × 1000 × 20% = 200; P2 é mais caro lá
    expect(p.produtoIds.sort()).toEqual([P1, P3].sort());
    expect(p).toMatchObject({ mercadoAlternativoId: B.id, economiaPrecoCentavos: 1200, custoIdaExtraCentavos: 360, economiaLiquidaCentavos: 840 });
  });

  it("bike elétrica (custo ~0) tende a propor", () => {
    const B = mercado({ distanciaKm: 10, transporte: "bike_eletrica" }); // 20 km × R$ 0,05 = R$ 1,00
    const p = proporDivisao({ itens, habitualId: A.id, mercados: [A, B], comparacoes: comp([1000, 1000, 1000], [900, 900, 900], B), perfil });
    expect(p).toMatchObject({ custoIdaExtraCentavos: 100, economiaLiquidaCentavos: 500 }); // 600 − 100 = 500 (== mínimo: propõe)
  });

  it("abaixo do mínimo configurável (R$ 5,00) não propõe, mesmo com líquido positivo", () => {
    const B = mercado({ distanciaKm: 2 });
    // economia 10% de R$ 60 = R$ 6,00 − R$ 3,60 = R$ 2,40 < R$ 5,00
    expect(proporDivisao({ itens, habitualId: A.id, mercados: [A, B], comparacoes: comp([1000, 1000, 1000], [900, 900, 900], B), perfil })).toBeUndefined();
    expect(proporDivisao({ itens, habitualId: A.id, mercados: [A, B], comparacoes: comp([1000, 1000, 1000], [900, 900, 900], B), perfil: { ...perfil, economiaMinimaDivisaoCentavos: 100 } })).toBeDefined();
  });

  it("sem distância (custo de ida desconhecido) o mercado não é avaliado", () => {
    const B = mercado();
    expect(proporDivisao({ itens, habitualId: A.id, mercados: [A, B], comparacoes: comp([1000, 1000, 1000], [100, 100, 100], B), perfil })).toBeUndefined();
  });

  it("escolhe a melhor entre várias alternativas; ignora itens removidos e sem preço", () => {
    const B = mercado({ distanciaKm: 2 });
    const C = mercado({ distanciaKm: 2 });
    const comps = melhorMercadoPorProduto(
      [compra("2026-11-01", A.id, [[P1, 1000]]), compra("2026-11-02", B.id, [[P1, 900]]), compra("2026-11-03", C.id, [[P1, 500]])],
      "2026-11-08",
    );
    const p = proporDivisao({ itens: [item(P1, 10), { ...item(P2, 5), removido: true }, item(crypto.randomUUID(), 4)], habitualId: A.id, mercados: [A, B, C], comparacoes: comps, perfil })!;
    expect(p.mercadoAlternativoId).toBe(C.id);
    expect(p.produtoIds).toEqual([P1]);
  });

  it("lista vazia e mesmo mercado", () => {
    const B = mercado({ distanciaKm: 1 });
    expect(proporDivisao({ itens: [], habitualId: A.id, mercados: [A, B], comparacoes: comp([1, 1, 1], [1, 1, 1], B), perfil })).toBeUndefined();
    expect(proporDivisao({ itens, habitualId: A.id, mercados: [A], comparacoes: comp([1, 1, 1], [1, 1, 1], B), perfil })).toBeUndefined();
  });
});

describe("avisoIdaPoucoVantajosa", () => {
  it.each([
    [{ itens: 4, totalEstimadoCentavos: 1800, custoIdaCentavos: 1100 }, ["custo_alto", "poucos_itens"]], // exemplo do blueprint
    [{ itens: 10, totalEstimadoCentavos: 10000, custoIdaCentavos: 4000 }, ["custo_alto"]], // exatamente 40%
    [{ itens: 10, totalEstimadoCentavos: 10000, custoIdaCentavos: 3999 }, undefined],
    [{ itens: 4, totalEstimadoCentavos: 10000, custoIdaCentavos: 100 }, ["poucos_itens"]],
    [{ itens: 5, totalEstimadoCentavos: 10000, custoIdaCentavos: 100 }, undefined],
    [{ itens: 8, totalEstimadoCentavos: 0, custoIdaCentavos: 500 }, undefined], // sem estimativa de total: não dá para comparar
    [{ itens: 0, totalEstimadoCentavos: 0, custoIdaCentavos: 0 }, ["poucos_itens"]],
  ] as const)("%j", (e, motivos) => expect(avisoIdaPoucoVantajosa(e)?.motivos).toEqual(motivos));

  it("limites parametrizáveis", () => {
    expect(avisoIdaPoucoVantajosa({ itens: 10, totalEstimadoCentavos: 10000, custoIdaCentavos: 2000, limitePct: 20 })?.motivos).toEqual(["custo_alto"]);
    expect(avisoIdaPoucoVantajosa({ itens: 3, totalEstimadoCentavos: 10000, custoIdaCentavos: 100, minItens: 3 })).toBeUndefined();
  });
});

import { mercadoHabitualDaCasa } from "@/domain/economia";
describe("mercadoHabitualDaCasa", () => {
  it("o primeiro definido na agenda (semanal, hortifruti, feira); sem agenda, o mais usado", () => {
    expect(mercadoHabitualDaCasa([{ tipo: "feira_mensal", mercadoId: "F" }, { tipo: "hortifruti_semanal", mercadoId: "H" }], [])).toBe("H");
    expect(mercadoHabitualDaCasa([{ tipo: "mercado_semanal", mercadoId: "M" }, { tipo: "hortifruti_semanal", mercadoId: "H" }], [])).toBe("M");
    expect(mercadoHabitualDaCasa([{ tipo: "mercado_semanal" }], [{ mercadoId: "X" }, { mercadoId: "Y" }, { mercadoId: "Y" }])).toBe("Y");
    expect(mercadoHabitualDaCasa([], [])).toBeUndefined();
  });
});
