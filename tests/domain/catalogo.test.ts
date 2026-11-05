import { describe, expect, it } from "vitest";
import { categoriaInicial, chaveDeNome, novoProduto } from "@/domain/catalogo";
import { sugerirTipoMercado } from "@/domain/mercados";
import { produtoSchema } from "@/schemas";

describe("novoProduto", () => {
  const base = { id: crypto.randomUUID(), casaId: crypto.randomUUID(), mercadoTipo: "hortifruti" as const };

  it("hortifruti: unidade kg, meta = quantidade, vida útil 7, ida de hortifruti", () => {
    const p = novoProduto({ ...base, nome: " Melao Japones ", item: { unidade: "KG", quantidade: 1.26 } });
    expect(p).toMatchObject({
      nome: "Melao Japones", unidade: "kg", categoria: "hortifruti", meta: 1.26, metaManual: false,
      tipoIda: "hortifruti_semanal", vidaUtilDias: 7, frequencia: "semanal", ativo: true,
    });
    expect(produtoSchema.safeParse(p).success).toBe(true);
  });

  it.each([
    ["UNID", "un"],
    ["PCT", "pacote"],
    ["L", "l"],
  ] as const)("unidade %s vira %s", (nota, produto) => {
    expect(novoProduto({ ...base, nome: "X", item: { unidade: nota, quantidade: 1 } }).unidade).toBe(produto);
  });

  it("mercado que não é hortifruti: categoria outros, ida de mercado semanal, vida útil 90", () => {
    const p = novoProduto({ ...base, mercadoTipo: "supermercado", nome: "Arroz", item: { unidade: "PCT", quantidade: 1 } });
    expect(p).toMatchObject({ categoria: "outros", tipoIda: "mercado_semanal", vidaUtilDias: 90 });
    expect(categoriaInicial("atacarejo")).toBe("outros");
  });
});

describe("chaveDeNome", () => {
  it("ignora caixa, acento e espaços", () => {
    expect(chaveDeNome("  Pimentão   Verde ")).toBe(chaveDeNome("pimentao verde"));
  });
});

describe("sugerirTipoMercado", () => {
  it.each([
    ["CIA SANTOS DISTRIBUIDORA E IMPORTADORA DE HORTIFRUTI LTDA", "hortifruti"],
    ["Sacolão do Zé", "hortifruti"],
    ["ASSAI ATACADISTA S/A", "atacarejo"],
    ["Atacarejo Bom Preço", "atacarejo"],
    ["SUPERMERCADO EXTRA", "supermercado"],
    ["", "supermercado"],
  ])("%s → %s", (nome, tipo) => expect(sugerirTipoMercado(nome)).toBe(tipo));
});
