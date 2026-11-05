import { describe, expect, it } from "vitest";
import { categoriaPorNome } from "@/domain/categorias";

describe("categoriaPorNome", () => {
  it("mercado de hortifruti: tudo é hortifruti", () => {
    expect(categoriaPorNome("Melao Japones", "hortifruti")).toBe("hortifruti");
    expect(categoriaPorNome("Qualquer Coisa", "hortifruti")).toBe("hortifruti");
  });

  it.each([
    ["Arroz Tipo 1", "mercearia"],
    ["Feijão Carioca", "mercearia"],
    ["Café Torrado", "mercearia"],
    ["Sal Refinado", "mercearia"],
    ["Pão de Forma", "mercearia"],
    ["Leite Integral UHT", "laticinios"],
    ["Queijo Mussarela", "laticinios"],
    ["Iogurte Natural", "laticinios"],
    ["Peito de Frango", "carnes"],
    ["Linguiça Toscana", "carnes"],
    ["Salsicha Hot Dog", "carnes"], // "sal" não casa o começo de "salsicha" (palavra inteira)
    ["Detergente Líquido", "limpeza"],
    ["Água Sanitária", "limpeza"],
    ["Sabão em Pó", "limpeza"],
    ["Shampoo Anticaspa", "higiene"],
    ["Papel Higiênico", "higiene"],
    ["Creme Dental", "higiene"],
    ["Refrigerante Cola", "bebidas"],
    ["Suco de Uva", "bebidas"],
    ["Tomate Italiano", "hortifruti"],
    ["Banana Prata", "hortifruti"],
    ["Pilha AA", "outros"],
    ["", "outros"],
  ])("%s → %s", (nome, esperado) => expect(categoriaPorNome(nome, "supermercado")).toBe(esperado));

  it("ordem: limpeza e higiene vencem palavras genéricas (ex.: 'sabonete de leite')", () => {
    expect(categoriaPorNome("Sabonete de Leite", "supermercado")).toBe("higiene");
    expect(categoriaPorNome("Detergente de Limão", "atacarejo")).toBe("limpeza");
  });

  it("palavra inteira: 'sal' não casa 'salmão' nem 'salada'", () => {
    expect(categoriaPorNome("Sal Grosso", "supermercado")).toBe("mercearia");
    expect(categoriaPorNome("Salada Pronta", "supermercado")).toBe("outros");
  });
});
