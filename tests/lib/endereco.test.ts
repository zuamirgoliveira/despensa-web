import { describe, expect, it } from "vitest";
import { separarEndereco, variantesDeEndereco } from "@/lib/endereco";

const NOTA = "AVENIDA GOVERNADOR CARLOS DE LIMA CAVALC ,  1245 ,  CASA CAIADA ,  OLINDA ,  PE";

describe("separarEndereco", () => {
  it("endereço da nota de exemplo, com espaços antes das vírgulas", () => {
    expect(separarEndereco(NOTA)).toEqual({
      logradouro: "AVENIDA GOVERNADOR CARLOS DE LIMA CAVALC", numero: "1245", bairro: "CASA CAIADA", cidade: "OLINDA", uf: "PE",
    });
  });
  it("sem número", () => {
    expect(separarEndereco("RUA DAS FLORES , CENTRO , RECIFE , PE")).toEqual({
      logradouro: "RUA DAS FLORES", numero: undefined, bairro: "CENTRO", cidade: "RECIFE", uf: "PE",
    });
  });
  it("S/N conta como número", () => expect(separarEndereco("RUA A , S/N , CENTRO , RECIFE , PE")?.numero).toBe("S/N"));
  it("texto sem vírgulas ou vazio", () => {
    expect(separarEndereco("")).toBeNull();
    expect(separarEndereco("SEM VIRGULA")).toBeNull();
  });
});

describe("variantesDeEndereco", () => {
  it("primeira consulta é o endereço completo, normalizado", () => {
    expect(variantesDeEndereco(NOTA)[0]).toEqual({
      consulta: "Avenida Governador Carlos de Lima Cavalc, 1245, Casa Caiada, Olinda, PE, Brasil",
      precisao: "endereco",
    });
  });

  it("logradouro de 40 caracteres é tratado como truncado: tenta sem a última palavra", () => {
    const v = variantesDeEndereco(NOTA).map((x) => x.consulta);
    expect(v).toContain("Avenida Governador Carlos de Lima, 1245, Casa Caiada, Olinda, PE, Brasil");
    expect(v).toContain("Avenida Governador Carlos de Lima, Casa Caiada, Olinda, PE, Brasil");
  });

  it("termina em aproximação por bairro, nunca só pela cidade", () => {
    const v = variantesDeEndereco(NOTA);
    expect(v[v.length - 1]).toEqual({ consulta: "Casa Caiada, Olinda, PE, Brasil", precisao: "bairro" });
    expect(v.every((x) => x.consulta !== "Olinda, PE, Brasil")).toBe(true);
  });

  it("do mais preciso para o mais aproximado", () => {
    const ordem = { endereco: 0, rua: 1, bairro: 2 } as const;
    const p = variantesDeEndereco(NOTA).map((x) => ordem[x.precisao]);
    expect(p).toEqual([...p].sort((a, b) => a - b));
  });

  it.each([
    ["AV BOA VIAGEM , 100 , BOA VIAGEM , RECIFE , PE", "Avenida Boa Viagem, 100, Boa Viagem, Recife, PE, Brasil"],
    ["R. DA AURORA , 5 , BOA VISTA , RECIFE , PE", "Rua da Aurora, 5, Boa Vista, Recife, PE, Brasil"],
    ["TRAV DOS PINHEIROS , 7 , CENTRO , OLINDA , PE", "Travessa dos Pinheiros, 7, Centro, Olinda, PE, Brasil"],
    ["ROD BR 101 , S/N , DISTRITO , JABOATAO , PE", "Rodovia Br 101, Distrito, Jaboatao, PE, Brasil"],
  ])("%s", (entrada, esperado) => expect(variantesDeEndereco(entrada)[0].consulta).toBe(esperado));

  it("logradouro curto não é tratado como truncado", () => {
    const v = variantesDeEndereco("RUA DAS FLORES , 10 , CENTRO , RECIFE , PE");
    expect(v.map((x) => x.consulta)).toEqual([
      "Rua das Flores, 10, Centro, Recife, PE, Brasil",
      "Rua das Flores, Centro, Recife, PE, Brasil",
      "Centro, Recife, PE, Brasil",
    ]);
  });

  it("endereço ilegível devolve lista vazia", () => expect(variantesDeEndereco("???")).toEqual([]));
});
