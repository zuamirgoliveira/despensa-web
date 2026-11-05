import { describe, expect, it } from "vitest";
import {
  agendaIdaSchema,
  apelidoMercadoSchema,
  casaSchema,
  compraSchema,
  estoqueSchema,
  itemListaSchema,
  listaSchema,
  mercadoSchema,
  perfilSchema,
  produtoSchema,
  VIDA_UTIL_PADRAO_DIAS,
} from "@/schemas";

const id = () => crypto.randomUUID();
const casaId = id();
const chave = "26261108868231000638650020000689031020778720";

describe("schemas", () => {
  it("casa", () => {
    expect(casaSchema.safeParse({ id: id(), nome: "Casa" }).success).toBe(true);
    expect(casaSchema.safeParse({ id: "x", nome: "Casa" }).success).toBe(false);
    expect(casaSchema.safeParse({ id: id(), nome: " " }).success).toBe(false);
  });

  it("perfil aplica padrões", () => {
    const p = perfilSchema.parse({ id: id(), casaId });
    expect(p.folgaDias).toBe(2);
    expect(p.limiarAlertaPrecoPct).toBe(20);
    expect(p.carro).toEqual({ consumoKmPorLitro: 10, precoCombustivelCentavos: 600, desgasteCentavosPorKm: 30 });
    expect(p.bikeCentavosPorKm).toBe(5);
    expect(perfilSchema.safeParse({ id: id(), casaId, folgaDias: -1 }).success).toBe(false);
    expect(perfilSchema.safeParse({ id: id(), casaId, localizacaoCasa: { lat: 91, lng: 0 } }).success).toBe(false);
  });

  it("agenda exige o dia certo para cada tipo", () => {
    expect(agendaIdaSchema.safeParse({ id: id(), casaId, tipo: "feira_mensal", diaDoMes: 5 }).success).toBe(true);
    expect(agendaIdaSchema.safeParse({ id: id(), casaId, tipo: "feira_mensal" }).success).toBe(false);
    expect(agendaIdaSchema.safeParse({ id: id(), casaId, tipo: "feira_mensal", diaDoMes: 32 }).success).toBe(false);
    expect(agendaIdaSchema.safeParse({ id: id(), casaId, tipo: "mercado_semanal", diaDaSemana: 6 }).success).toBe(true);
    expect(agendaIdaSchema.safeParse({ id: id(), casaId, tipo: "hortifruti_semanal", diaDaSemana: 7 }).success).toBe(false);
    expect(agendaIdaSchema.safeParse({ id: id(), casaId, tipo: "mercado_semanal" }).success).toBe(false);
  });

  it("mercado valida CNPJ de 14 dígitos", () => {
    const base = { id: id(), casaId, nome: "Cia Santos" };
    expect(mercadoSchema.safeParse({ ...base, cnpj: "08868231000638" }).success).toBe(true);
    expect(mercadoSchema.safeParse({ ...base, cnpj: "08.868.231/0006-38" }).success).toBe(false);
  });

  it("produto", () => {
    const base = { id: id(), casaId, nome: "Tomate", unidade: "kg", meta: 1, tipoIda: "hortifruti_semanal", vidaUtilDias: 7 };
    const p = produtoSchema.parse(base);
    expect(p.ativo).toBe(true);
    expect(p.metaManual).toBe(false);
    expect(p.categoria).toBe("outros");
    expect(produtoSchema.safeParse({ ...base, unidade: "caixa" }).success).toBe(false);
    expect(produtoSchema.safeParse({ ...base, meta: -1 }).success).toBe(false);
  });

  it("apelido por mercado", () => {
    expect(apelidoMercadoSchema.safeParse({ casaId, cnpj: "08868231000638", codigo: "52", produtoId: id() }).success).toBe(true);
    expect(apelidoMercadoSchema.safeParse({ casaId, cnpj: "08868231000638", codigo: "", produtoId: id() }).success).toBe(false);
  });

  it("estoque", () => {
    const base = { id: id(), casaId, produtoId: id(), confirmadoEm: "2026-11-05T10:00:00-03:00" };
    expect(estoqueSchema.safeParse({ ...base, nivel: "metade" }).success).toBe(true);
    expect(estoqueSchema.safeParse({ ...base, nivel: "vazio" }).success).toBe(false);
  });

  it("compra usa centavos inteiros e chave de 44 dígitos", () => {
    const item = { codigo: "52", descricao: "TOMATE KG", quantidade: 1.26, unidade: "KG", valorUnitarioCentavos: 788, valorTotalCentavos: 993 };
    const base = {
      casaId,
      chave,
      mercadoId: id(),
      emissao: "2026-11-04T10:33:31",
      valorTotalCentavos: 7724,
      itens: [item],
      importadoEm: "2026-11-05T10:00:00Z",
    };
    expect(compraSchema.safeParse(base).success).toBe(true);
    expect(compraSchema.safeParse({ ...base, chave: "123" }).success).toBe(false);
    expect(compraSchema.safeParse({ ...base, valorTotalCentavos: 77.24 }).success).toBe(false);
    expect(compraSchema.safeParse({ ...base, emissao: "04/11/2026" }).success).toBe(false);
    expect(compraSchema.safeParse({ ...base, itens: [{ ...item, valorUnitarioCentavos: 7.88 }] }).success).toBe(false);
  });

  it("lista e item da lista", () => {
    expect(listaSchema.parse({ id: id(), casaId, tipoIda: "mercado_semanal", data: "2026-11-07", criadaEm: "2026-11-05T10:00:00Z" }).status).toBe("rascunho");
    expect(listaSchema.safeParse({ id: id(), casaId, tipoIda: "mercado_semanal", data: "07/11/2026", criadaEm: "2026-11-05T10:00:00Z" }).success).toBe(false);
    const base = { id: id(), casaId, listaId: id(), quantidadeSugerida: 2 };
    expect(itemListaSchema.safeParse({ ...base, produtoId: id() }).success).toBe(true);
    expect(itemListaSchema.safeParse({ ...base, nomeAvulso: "Pilha" }).success).toBe(true);
    expect(itemListaSchema.safeParse(base).success).toBe(false);
  });

  it("vida útil padrão por categoria", () => {
    expect(VIDA_UTIL_PADRAO_DIAS).toEqual({
      hortifruti: 7, laticinios: 10, carnes: 3, mercearia: 180, limpeza: 365, higiene: 365, bebidas: 90, outros: 90,
    });
  });
});
