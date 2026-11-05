import { describe, expect, it } from "vitest";
import { ROTAS, rotaAtiva } from "@/lib/rotas";

describe("rotaAtiva", () => {
  it.each([
    ["/", "/", true],
    ["/lista", "/", false],
    ["/lista", "/lista", true],
    ["/lista/x", "/lista", true],
    ["/compra", "/compras", false],
    ["/compras", "/compra", false],
    ["/compras", "/compras", true],
  ])("%s em %s → %s", (caminho, href, esperado) => expect(rotaAtiva(caminho, href)).toBe(esperado));
});

describe("ROTAS", () => {
  it("barra: Início, Importar, Lista, Compras; o resto cabe no menu Mais", () => {
    expect(ROTAS.filter((r) => r.naBarra).map((r) => r.rotulo)).toEqual(["Início", "Importar", "Lista", "Compras"]);
    expect(ROTAS.filter((r) => r.noMais).map((r) => r.rotulo)).toEqual(["Conferir despensa", "Catálogo", "Preços", "Painel", "Gastos", "Mercados", "Ajustes"]);
  });
  it("nenhuma rota está na barra e no Mais ao mesmo tempo, e não há href repetido", () => {
    expect(ROTAS.filter((r) => r.naBarra && r.noMais)).toEqual([]);
    expect(new Set(ROTAS.map((r) => r.href)).size).toBe(ROTAS.length);
  });
});
