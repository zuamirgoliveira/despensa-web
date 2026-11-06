import { describe, expect, it } from "vitest";
import { padraoSugerido, promoverARecorrente, rebaixarDeRecorrente, sugerirDeixarDeRepor, sugerirReporSempre } from "@/domain/recorrencia";
import type { Compra, Produto } from "@/domain/types";

const compra = (emissao: string, quantidade: number, produtoId = "p"): Compra => ({
  casaId: "c", chave: emissao + quantidade, mercadoId: "m", emissao, valorTotalCentavos: 1, pagamento: "", importadoEm: "x",
  itens: [{ codigo: "1", descricao: "X", produtoId, quantidade, unidade: "UNID", valorUnitarioCentavos: 1, valorTotalCentavos: 1 }],
}) as Compra;
const prod = (extra: Partial<Produto> = {}): Produto => ({
  id: "p", casaId: "c", nome: "P", categoria: "mercearia", unidade: "un", meta: 0, metaManual: false, recorrente: false,
  frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
});

describe("padraoSugerido", () => {
  it("média por nota, arredondada ao passo", () => {
    expect(padraoSugerido(prod(), [compra("2026-10-01T10:00:00", 2), compra("2026-10-08T10:00:00", 3)])).toBe(3); // 2,5 → 3 un
    expect(padraoSugerido(prod({ unidade: "kg" }), [compra("2026-10-01T10:00:00", 1.26)])).toBe(1.3);
  });
  it("meta digitada à mão prevalece sobre a média", () => {
    expect(padraoSugerido(prod({ meta: 6, metaManual: true }), [compra("2026-10-01T10:00:00", 2)])).toBe(6);
  });
  it("sem compras usa a meta atual; sem nada, undefined", () => {
    expect(padraoSugerido(prod({ meta: 4 }), [])).toBe(4);
    expect(padraoSugerido(prod(), [])).toBeUndefined();
  });
  it("nunca abaixo de um passo", () => {
    expect(padraoSugerido(prod({ unidade: "kg" }), [compra("2026-10-01T10:00:00", 0.02)])).toBe(0.1);
  });
});

describe("sugerirReporSempre", () => {
  const tres = [compra("2026-10-01T10:00:00", 1), compra("2026-10-09T10:00:00", 1), compra("2026-10-20T10:00:00", 1)];
  it("3 notas: sugere; 2: não", () => {
    expect(sugerirReporSempre(prod(), tres)?.acao).toBe("repor_sempre");
    expect(sugerirReporSempre(prod(), tres.slice(0, 2))).toBeUndefined();
  });
  it("já recorrente ou arquivado: não", () => {
    expect(sugerirReporSempre(prod({ recorrente: true }), tres)).toBeUndefined();
    expect(sugerirReporSempre(prod({ ativo: false }), tres)).toBeUndefined();
  });
  it("itens do mesmo produto na mesma nota contam uma vez", () => {
    const c = compra("2026-10-01T10:00:00", 1);
    c.itens.push({ ...c.itens[0] }, { ...c.itens[0] });
    expect(sugerirReporSempre(prod(), [c])).toBeUndefined();
  });
});

describe("sugerirDeixarDeRepor", () => {
  const r = prod({ recorrente: true });
  const ult = [compra("2026-08-01T10:00:00", 1)];
  it("90 dias exatos não sugere; 91 sim", () => {
    expect(sugerirDeixarDeRepor(r, ult, "2026-10-30")).toBeUndefined();
    expect(sugerirDeixarDeRepor(r, ult, "2026-10-31")?.acao).toBe("deixar_de_repor");
  });
  it("nunca comprado, não recorrente ou arquivado: não", () => {
    expect(sugerirDeixarDeRepor(r, [], "2027-01-01")).toBeUndefined();
    expect(sugerirDeixarDeRepor(prod(), ult, "2027-01-01")).toBeUndefined();
    expect(sugerirDeixarDeRepor(prod({ recorrente: true, ativo: false }), ult, "2027-01-01")).toBeUndefined();
  });
});

describe("promover e rebaixar", () => {
  it("confirmar o sugerido não trava a meta automática", () => {
    expect(promoverARecorrente(prod(), 3, 3)).toMatchObject({ recorrente: true, meta: 3, metaManual: false });
    expect(promoverARecorrente(prod(), undefined, 3)).toMatchObject({ recorrente: true, meta: 3, metaManual: false });
  });
  it("valor digitado diferente do sugerido trava", () => {
    expect(promoverARecorrente(prod(), 5, 3)).toMatchObject({ meta: 5, metaManual: true });
  });
  it("sem padrão algum, mantém a meta atual (item recorrente só por zerar)", () => {
    expect(promoverARecorrente(prod({ meta: 0 }), undefined, undefined)).toMatchObject({ recorrente: true, meta: 0 });
  });
  it("deixar de repor mantém o padrão e o histórico", () => {
    expect(rebaixarDeRecorrente(prod({ recorrente: true, meta: 4, metaManual: true }))).toMatchObject({ recorrente: false, meta: 4, metaManual: true });
  });
});
