import { describe, expect, it } from "vitest";
import { converterEstoqueLegado, gerarListaDaCasa, nivelDeQuantidade, quantidadeDoNivel, quantidadeQueFalta, situacaoDoItem } from "@/domain/despensa";
import type { Compra, Estoque, Produto } from "@/domain/types";

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


const prod = (id: string, extra: Partial<Produto> = {}): Produto => ({
  id, casaId: "c", nome: id, categoria: "mercearia", unidade: "un", meta: 4, metaManual: true, recorrente: true,
  frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
});
const est = (produtoId: string, quantidade: number): Estoque => ({ id: `e-${produtoId}`, casaId: "c", produtoId, quantidade, nivel: "cheio", confirmadoEm: "2026-11-01T10:00:00Z" });

describe("situacaoDoItem / quantidadeQueFalta", () => {
  it.each([
    [4, 0, "zerado", 4], [4, 1, "abaixo", 3], [4, 1.9, "abaixo", 2.1], [4, 2, "parcial", 2], [4, 3, "parcial", 1], [4, 4, "ok", 0], [4, 9, "acima", 0], [0, 0, "zerado", undefined], [0, 3, "ok", undefined],
  ] as const)("padrão %d, atual %d → %s, falta %s", (meta, atual, situacao, falta) => {
    expect(situacaoDoItem({ meta }, { quantidade: atual })).toBe(situacao);
    expect(quantidadeQueFalta({ meta }, { quantidade: atual })).toBe(falta);
  });
  it("sem registro", () => {
    expect(situacaoDoItem({ meta: 4 }, undefined)).toBe("sem_registro");
    expect(quantidadeQueFalta({ meta: 4 }, undefined)).toBeUndefined();
  });
  it("ponto flutuante: 0,1 + 0,2 de 0,3 está no padrão", () => {
    expect(situacaoDoItem({ meta: 0.3 }, { quantidade: 0.1 + 0.2 })).toBe("ok");
  });
});

describe("nivelDeQuantidade", () => {
  it.each([[10, "cheio"], [7.5, "cheio"], [7.4, "metade"], [3.5, "metade"], [3.4, "acabando"], [0.6, "acabando"], [0.5, "acabou"], [0, "acabou"], [30, "cheio"]] as const)(
    "%d de 10 → %s", (q, n) => expect(nivelDeQuantidade(q, 10)).toBe(n),
  );
  it("sem padrão não rotula", () => expect(nivelDeQuantidade(2, undefined)).toBeUndefined());
});

describe("gerarListaDaCasa", () => {
  const lista = (produtos: Produto[], estoques: Estoque[]) => gerarListaDaCasa({ produtos, estoques, compras: [] });

  it("zerado entra com o padrão; abaixo entra com o que falta; ok e acima não entram", () => {
    const r = lista([prod("a"), prod("b"), prod("c"), prod("d"), prod("e")], [est("a", 0), est("b", 1), est("c", 4), est("d", 9), est("e", 2)]);
    expect(r.itens.map((i) => [i.produtoId, i.quantidade, i.motivo])).toEqual([["a", 4, "acabou"], ["b", 3, "abaixo"]]); // "e" está em 50%: ainda não repõe
  });
  it("arredonda ao passo da unidade (kg: 0,1) e respeita o mínimo", () => {
    const r = lista([prod("k", { unidade: "kg", meta: 1.05 })], [est("k", 0.52)]);
    expect(r.itens[0].quantidade).toBe(0.6);
  });
  it("zerado sem padrão usa a última quantidade comprada; sem compra, uma unidade", () => {
    const sem = prod("s", { meta: 0 });
    expect(lista([sem], [est("s", 0)]).itens[0].quantidade).toBe(1);
    const compra = { casaId: "c", chave: "1", mercadoId: "m", emissao: "2026-10-01T10:00:00", valorTotalCentavos: 1, pagamento: "", importadoEm: "x",
      itens: [{ codigo: "1", descricao: "S", produtoId: "s", quantidade: 3, unidade: "UNID", valorUnitarioCentavos: 250, valorTotalCentavos: 750 }] } as Compra;
    const r = gerarListaDaCasa({ produtos: [sem], estoques: [est("s", 0)], compras: [compra] });
    expect(r.itens[0]).toMatchObject({ quantidade: 3, precoEstimadoCentavos: 750 });
    expect(r.resumo.totalEstimadoCentavos).toBe(750);
  });
  it("sem padrão e com quantidade > 0 não entra", () => {
    expect(lista([prod("s", { meta: 0 })], [est("s", 2)]).itens).toEqual([]);
  });
  it("não recorrente nunca entra; se zerou, vira aviso", () => {
    const r = lista([prod("x", { recorrente: false }), prod("y", { recorrente: false })], [est("x", 0), est("y", 1)]);
    expect(r.itens).toEqual([]);
    expect(r.naoRecorrentesZerados).toEqual(["x"]);
  });
  it("arquivado e sem registro nunca entram", () => {
    const r = lista([prod("a", { ativo: false }), prod("b")], [est("a", 0)]);
    expect(r.itens).toEqual([]);
    expect(r.resumo.semPreco).toEqual([]);
  });
  it("itens sem preço ficam fora da soma e são listados", () => {
    const r = lista([prod("a")], [est("a", 0)]);
    expect(r.resumo).toMatchObject({ totalEstimadoCentavos: 0, semPreco: ["a"] });
  });
});

describe("ordem da lista da casa", () => {
  it("zerados primeiro, depois do mais vazio ao menos vazio; empate por nome", () => {
    const produtos = [prod("Zeta", { meta: 10 }), prod("Beta", { meta: 10 }), prod("Alfa", { meta: 10 }), prod("Gama", { meta: 10 }), prod("Delta", { meta: 8 })];
    const estoques = [est("Zeta", 4), est("Beta", 0), est("Alfa", 2), est("Gama", 0), est("Delta", 4)]; // frações: 0,4 · 0 · 0,2 · 0 · 0,5(fora)
    const r = gerarListaDaCasa({ produtos, estoques, compras: [] });
    expect(r.itens.map((i) => i.produtoId)).toEqual(["Beta", "Gama", "Alfa", "Zeta"]);
  });
});
