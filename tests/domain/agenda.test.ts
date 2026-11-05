import { describe, expect, it } from "vitest";
import { idaSeguinte, ocorrenciasEntre, proximaIdaDoTipo, proximaOcorrencia, tiposCompativeis } from "@/domain/agenda";
import type { AgendaIda } from "@/domain/types";
import { diaDaSemana, montarData, ultimoDiaDoMes } from "@/lib/datas";

const casaId = crypto.randomUUID();
const mensal = (diaDoMes: number): AgendaIda => ({ id: crypto.randomUUID(), casaId, tipo: "feira_mensal", diaDoMes });
const semanal = (diaDaSemana: number, tipo: AgendaIda["tipo"] = "mercado_semanal"): AgendaIda => ({
  id: crypto.randomUUID(), casaId, tipo, diaDaSemana,
});

describe("helpers de calendário", () => {
  it("diaDaSemana: 04/11/2026 é quarta", () => expect(diaDaSemana("2026-11-04")).toBe(3));
  it("ultimoDiaDoMes", () => {
    expect(ultimoDiaDoMes(2026, 4)).toBe(30);
    expect(ultimoDiaDoMes(2026, 2)).toBe(28);
    expect(ultimoDiaDoMes(2028, 2)).toBe(29);
    expect(ultimoDiaDoMes(1900, 2)).toBe(28);
    expect(ultimoDiaDoMes(2026, 12)).toBe(31);
  });
  it("montarData", () => expect(montarData(2026, 3, 5)).toBe("2026-03-05"));
});

describe("proximaOcorrencia: semanal (as 7 posições)", () => {
  // 2026-11-01 é domingo
  it.each([
    [0, "2026-11-01"],
    [1, "2026-11-02"],
    [2, "2026-11-03"],
    [3, "2026-11-04"],
    [4, "2026-11-05"],
    [5, "2026-11-06"],
    [6, "2026-11-07"],
  ])("dia da semana %d a partir de domingo 01/11", (dia, esperado) => {
    expect(proximaOcorrencia(semanal(dia), "2026-11-01")).toBe(esperado);
  });

  it("hoje é o dia: com e sem incluirHoje", () => {
    expect(proximaOcorrencia(semanal(3), "2026-11-04", true)).toBe("2026-11-04");
    expect(proximaOcorrencia(semanal(3), "2026-11-04", false)).toBe("2026-11-11");
  });

  it("virada de mês e de ano", () => {
    expect(proximaOcorrencia(semanal(6), "2026-10-31")).toBe("2026-10-31"); // sábado
    expect(proximaOcorrencia(semanal(0), "2026-12-31")).toBe("2027-01-03"); // quinta → domingo
  });

  it("sem dia da semana lança erro", () => {
    expect(() => proximaOcorrencia({ tipo: "mercado_semanal" }, "2026-11-01")).toThrow(/dia da semana/);
  });
});

describe("proximaOcorrencia: mensal", () => {
  it("dia futuro no mesmo mês", () => expect(proximaOcorrencia(mensal(30), "2026-11-04")).toBe("2026-11-30"));
  it("dia já passado vai para o mês seguinte", () => expect(proximaOcorrencia(mensal(5), "2026-11-10")).toBe("2026-12-05"));

  it("hoje é o dia: com e sem incluirHoje", () => {
    expect(proximaOcorrencia(mensal(5), "2026-11-05", true)).toBe("2026-11-05");
    expect(proximaOcorrencia(mensal(5), "2026-11-05", false)).toBe("2026-12-05");
  });

  it.each([
    [31, "2026-04-01", "2026-04-30"], // abril tem 30
    [31, "2026-06-15", "2026-06-30"],
    [30, "2026-02-01", "2026-02-28"], // fevereiro de 2026
    [30, "2028-02-01", "2028-02-29"], // bissexto
    [31, "2026-02-01", "2026-02-28"],
    [29, "2026-02-01", "2026-02-28"],
    [29, "2028-02-01", "2028-02-29"],
    [31, "2026-01-01", "2026-01-31"],
  ])("dia %d a partir de %s → %s (ajusta ao último dia do mês)", (dia, de, esperado) => {
    expect(proximaOcorrencia(mensal(dia), de)).toBe(esperado);
  });

  it("depois do último dia ajustado, vai para o mês seguinte com o dia cheio", () => {
    expect(proximaOcorrencia(mensal(31), "2026-04-30", false)).toBe("2026-05-31");
    expect(proximaOcorrencia(mensal(31), "2026-04-30", true)).toBe("2026-04-30");
    expect(proximaOcorrencia(mensal(30), "2026-01-31")).toBe("2026-02-28");
  });

  it("virada de ano", () => {
    expect(proximaOcorrencia(mensal(5), "2026-12-20")).toBe("2027-01-05");
    expect(proximaOcorrencia(mensal(31), "2026-12-31")).toBe("2026-12-31");
    expect(proximaOcorrencia(mensal(31), "2026-12-31", false)).toBe("2027-01-31");
  });

  it("sem dia do mês lança erro", () => {
    expect(() => proximaOcorrencia({ tipo: "feira_mensal" }, "2026-11-01")).toThrow(/dia do mês/);
  });
});

describe("ocorrenciasEntre", () => {
  it("semanal, pontas inclusas", () => {
    expect(ocorrenciasEntre(semanal(6), "2026-11-07", "2026-11-28")).toEqual(["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28"]);
  });
  it("mensal atravessando fevereiro e a virada de ano", () => {
    expect(ocorrenciasEntre(mensal(30), "2026-12-01", "2027-03-31")).toEqual(["2026-12-30", "2027-01-30", "2027-02-28", "2027-03-30"]);
  });
  it("intervalo sem ocorrência e intervalo invertido", () => {
    expect(ocorrenciasEntre(mensal(5), "2026-11-06", "2026-11-30")).toEqual([]);
    expect(ocorrenciasEntre(semanal(1), "2026-11-10", "2026-11-01")).toEqual([]);
  });
  it("um só dia", () => expect(ocorrenciasEntre(semanal(3), "2026-11-04", "2026-11-04")).toEqual(["2026-11-04"]));
});

describe("proximaIdaDoTipo / idaSeguinte", () => {
  const agendas = [mensal(5), semanal(6, "mercado_semanal"), semanal(3, "hortifruti_semanal")];

  it("escolhe a agenda do tipo e inclui hoje", () => {
    expect(proximaIdaDoTipo(agendas, "hortifruti_semanal", "2026-11-04")).toMatchObject({ tipo: "hortifruti_semanal", data: "2026-11-04" });
    expect(proximaIdaDoTipo(agendas, "mercado_semanal", "2026-11-04")).toMatchObject({ data: "2026-11-07" });
    expect(proximaIdaDoTipo(agendas, "feira_mensal", "2026-11-04")).toMatchObject({ data: "2026-11-05" });
  });

  it("idaSeguinte é estritamente posterior", () => {
    expect(idaSeguinte(agendas, "mercado_semanal", "2026-11-07")?.data).toBe("2026-11-14");
    expect(idaSeguinte(agendas, "feira_mensal", "2026-11-05")?.data).toBe("2026-12-05");
  });

  it("tipo sem agenda devolve undefined", () => {
    expect(proximaIdaDoTipo([mensal(5)], "mercado_semanal", "2026-11-04")).toBeUndefined();
    expect(idaSeguinte([], "feira_mensal", "2026-11-04")).toBeUndefined();
  });

  it("devolve o id da agenda", () => {
    expect(proximaIdaDoTipo(agendas, "feira_mensal", "2026-11-04")?.agendaId).toBe(agendas[0].id);
  });
});

describe("tiposCompativeis", () => {
  it.each([
    ["feira_mensal", "mercearia", ["mercado_semanal"]],
    ["feira_mensal", "limpeza", ["mercado_semanal"]],
    ["feira_mensal", "hortifruti", ["hortifruti_semanal"]],
    ["hortifruti_semanal", "hortifruti", ["hortifruti_semanal"]],
    ["mercado_semanal", "laticinios", ["mercado_semanal"]],
  ] as const)("%s / %s → %j", (tipoIda, categoria, esperado) => {
    expect(tiposCompativeis({ tipoIda, categoria })).toEqual(esperado);
  });
});
