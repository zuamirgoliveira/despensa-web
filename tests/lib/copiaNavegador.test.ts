import { describe, expect, it } from "vitest";
import { descreverContagens } from "@/components/ajustes/copiaNavegador";

describe("descreverContagens", () => {
  it("usa singular para 1 e plural nos demais, inclusive zero", () => {
    expect(descreverContagens({ compras: 1, produtos: 16, mercados: 1, apelidos: 0 })).toBe("1 compra, 16 produtos, 1 mercado, 0 apelidos");
    expect(descreverContagens({ compras: 12, produtos: 8, mercados: 2, apelidos: 16 })).toBe("12 compras, 8 produtos, 2 mercados, 16 apelidos");
  });
  it("coleção ausente conta como zero", () => {
    expect(descreverContagens({})).toBe("0 compras, 0 produtos, 0 mercados, 0 apelidos");
  });
});
