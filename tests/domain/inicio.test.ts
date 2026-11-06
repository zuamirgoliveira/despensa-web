import { describe, expect, it } from "vitest";
import { listasComNotaPendente, mercadosComEstimativaPendente, proximaIdaGeral, resumirDia } from "@/domain/inicio";
import type { AgendaIda, Compra, Estoque, Lista, Mercado, Produto } from "@/domain/types";
import { dataRecife } from "@/lib/datas";

const casaId = crypto.randomUUID();
const id = () => crypto.randomUUID();
const AGENDAS: AgendaIda[] = [
  { id: id(), casaId, tipo: "feira_mensal", diaDoMes: 30 },
  { id: id(), casaId, tipo: "mercado_semanal", diaDaSemana: 6 },
  { id: id(), casaId, tipo: "hortifruti_semanal", diaDaSemana: 3 },
];

describe("dataRecife", () => {
  it("converte o instante para a data em Recife (UTC−3)", () => {
    expect(dataRecife("2026-11-08T02:00:00.000Z")).toBe("2026-11-07");
    expect(dataRecife("2026-11-08T03:00:00.000Z")).toBe("2026-11-08");
    expect(dataRecife("2026-11-08T10:00:00-03:00")).toBe("2026-11-08");
  });
});

describe("proximaIdaGeral", () => {
  it("escolhe a de data mais próxima e informa em quantos dias", () => {
    expect(proximaIdaGeral(AGENDAS, "2026-11-08")).toMatchObject({ tipo: "hortifruti_semanal", data: "2026-11-11", diasAte: 3 });
    expect(proximaIdaGeral(AGENDAS, "2026-11-12")).toMatchObject({ tipo: "mercado_semanal", data: "2026-11-14", diasAte: 2 });
  });
  it("hoje conta (0 dias)", () => expect(proximaIdaGeral(AGENDAS, "2026-11-11")).toMatchObject({ tipo: "hortifruti_semanal", diasAte: 0 }));
  it("empate de data: a feira vem primeiro", () => {
    const empate: AgendaIda[] = [
      { id: id(), casaId, tipo: "mercado_semanal", diaDaSemana: 6 }, // 14/11/2026 é sábado
      { id: id(), casaId, tipo: "feira_mensal", diaDoMes: 14 },
    ];
    expect(proximaIdaGeral(empate, "2026-11-10")?.tipo).toBe("feira_mensal");
  });
  it("sem agendas: undefined", () => expect(proximaIdaGeral([], "2026-11-08")).toBeUndefined());
});

describe("listasComNotaPendente", () => {
  const lista = (status: Lista["status"], criadaEm: string): Lista => ({ id: id(), casaId, tipoIda: "mercado_semanal", data: "2026-11-07", status, criadaEm });
  it("só em_compra há mais de 1 dia", () => {
    const l = [
      lista("em_compra", "2026-11-05T12:00:00Z"), // 3 dias
      lista("em_compra", "2026-11-07T12:00:00Z"), // 1 dia: ainda não
      lista("em_compra", "2026-11-08T12:00:00Z"), // hoje
      lista("rascunho", "2026-10-01T12:00:00Z"),
      lista("fechada", "2026-10-01T12:00:00Z"),
    ];
    expect(listasComNotaPendente(l, "2026-11-08")).toEqual([l[0]]);
  });
  it("vazio", () => expect(listasComNotaPendente([], "2026-11-08")).toEqual([]));
});

describe("mercadosComEstimativaPendente", () => {
  const m = (): Mercado => ({ id: id(), casaId, cnpj: "08868231000638", nome: "M", endereco: "", tipo: "supermercado", transporte: "carro" });
  const c = (mercadoId: string, custoIdaCentavos?: number): Compra => ({
    casaId, chave: "1".repeat(44), mercadoId, emissao: "2026-11-04T10:00:00", valorTotalCentavos: 1, pagamento: "", itens: [], importadoEm: "2026-11-05T10:00:00Z", custoIdaCentavos,
  });
  it("mercados com alguma compra sem custo de ida", () => {
    const [a, b, d] = [m(), m(), m()];
    expect(mercadosComEstimativaPendente([a, b, d], [c(a.id), c(b.id, 756), c(b.id)])).toEqual([a, b]);
    expect(mercadosComEstimativaPendente([a], [c(a.id, 0)])).toEqual([]); // custo zero (bike) é um custo
    expect(mercadosComEstimativaPendente([], [])).toEqual([]);
  });
});

describe("resumirDia", () => {
  const produto = (extra: Partial<Produto> = {}): Produto => ({
    id: id(), casaId, nome: "P", categoria: "hortifruti", unidade: "un", meta: 7, metaManual: false, recorrente: true, frequencia: "semanal",
    tipoIda: "hortifruti_semanal", vidaUtilDias: 7, contavel: false, ativo: true, ...extra,
  });
  const base = { hoje: "2026-11-08", agendas: AGENDAS, folgaDias: 2, listas: [], mercados: [] };

  it("sem notas: orienta a primeira importação", () => {
    const r = resumirDia({ ...base, produtos: [], estoques: [], compras: [] });
    expect(r).toMatchObject({ semNotas: true, quantosVencem: 0, notasPendentes: [], estimativasPendentes: [] });
    expect(r.proxima?.tipo).toBe("hortifruti_semanal");
  });

  it("conta quantos produtos vencem na próxima ida", () => {
    const [a, b, c] = [produto(), produto(), produto({ tipoIda: "mercado_semanal" })];
    const est = (p: Produto): Estoque => ({ id: id(), casaId, produtoId: p.id, quantidade: 0, nivel: "acabou", confirmadoEm: "2026-11-08T10:00:00Z" });
    const r = resumirDia({ ...base, produtos: [a, b, c], estoques: [a, b, c].map(est), compras: [] });
    expect(r.proxima?.tipo).toBe("hortifruti_semanal");
    expect(r.quantosVencem).toBe(2); // só os do hortifruti
  });

  it("sem agendas: sem próxima ida e nada vence", () => {
    const r = resumirDia({ ...base, agendas: [], produtos: [produto()], estoques: [], compras: [] });
    expect(r.proxima).toBeUndefined();
    expect(r.quantosVencem).toBe(0);
  });
});
