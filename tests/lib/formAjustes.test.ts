import { describe, expect, it } from "vitest";
import { validarAgenda, validarPerfil, valoresDaAgenda, valoresDoPerfil } from "@/lib/formAjustes";
import { perfilSchema } from "@/schemas";
import type { AgendaIda } from "@/domain/types";

const casaId = crypto.randomUUID();
const perfil = perfilSchema.parse({ id: crypto.randomUUID(), casaId });

describe("formulário do perfil", () => {
  it("valores iniciais em reais e vírgula", () => {
    expect(valoresDoPerfil(perfil)).toEqual({
      folgaDias: "2", limiarAlertaPrecoPct: "20", economiaMinimaDivisao: "5,00", janelaPrecoDias: "60", consumoKmPorLitro: "10",
      precoCombustivel: "6,00", desgastePorKm: "0,30", bikePorKm: "0,05",
    });
  });

  it("ida e volta sem mudar nada", () => {
    expect(validarPerfil(perfil, valoresDoPerfil(perfil))).toEqual({ ok: true, perfil });
  });

  it("converte reais em centavos", () => {
    const r = validarPerfil(perfil, { ...valoresDoPerfil(perfil), precoCombustivel: "6,49", desgastePorKm: "0,35", bikePorKm: "0,08", economiaMinimaDivisao: "7,50" });
    expect(r.ok && r.perfil.carro).toMatchObject({ precoCombustivelCentavos: 649, desgasteCentavosPorKm: 35 });
    expect(r.ok && r.perfil.bikeCentavosPorKm).toBeCloseTo(8);
    expect(r.ok && r.perfil.economiaMinimaDivisaoCentavos).toBe(750);
  });

  it("erros por campo, em português", () => {
    const r = validarPerfil(perfil, { ...valoresDoPerfil(perfil), folgaDias: "-1", consumoKmPorLitro: "0", precoCombustivel: "abc", limiarAlertaPrecoPct: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.folgaDias).toMatch(/0 a 30/);
      expect(r.erros.consumoKmPorLitro).toMatch(/maior que zero/);
      expect(r.erros.precoCombustivel).toBeDefined();
      expect(r.erros.limiarAlertaPrecoPct).toBeDefined();
      expect(r.erros.bikePorKm).toBeUndefined();
    }
  });

  it("folga fracionária e acima de 30 são rejeitadas", () => {
    expect(validarPerfil(perfil, { ...valoresDoPerfil(perfil), folgaDias: "1,5" }).ok).toBe(false);
    expect(validarPerfil(perfil, { ...valoresDoPerfil(perfil), folgaDias: "31" }).ok).toBe(false);
    expect(validarPerfil(perfil, { ...valoresDoPerfil(perfil), folgaDias: "0" }).ok).toBe(true);
  });
});

describe("formulário da agenda", () => {
  const novo = crypto.randomUUID();
  const id = () => novo;
  const existente: AgendaIda = { id: crypto.randomUUID(), casaId, tipo: "mercado_semanal", diaDaSemana: 6 };

  it("valores da agenda existente e da ausente", () => {
    expect(valoresDaAgenda(existente)).toEqual({ dia: "6", mercadoId: "" });
    expect(valoresDaAgenda(undefined)).toEqual({ dia: "", mercadoId: "" });
    expect(valoresDaAgenda({ ...existente, tipo: "feira_mensal", diaDoMes: 5, diaDaSemana: undefined })).toEqual({ dia: "5", mercadoId: "" });
  });

  it("semanal: dia da semana 0 (domingo) é válido; 7 não", () => {
    expect(validarAgenda("mercado_semanal", casaId, undefined, { dia: "0", mercadoId: "" }, id)).toMatchObject({ ok: true, agenda: { id: novo, diaDaSemana: 0 } });
    expect(validarAgenda("mercado_semanal", casaId, existente, { dia: "7", mercadoId: "" }, id)).toEqual({ ok: false, erro: "Escolha o dia da semana." });
  });

  it("mensal: 1 a 31", () => {
    expect(validarAgenda("feira_mensal", casaId, undefined, { dia: "31", mercadoId: "" }, id).ok).toBe(true);
    expect(validarAgenda("feira_mensal", casaId, undefined, { dia: "32", mercadoId: "" }, id)).toEqual({ ok: false, erro: "Escolha o dia do mês (1 a 31)." });
    expect(validarAgenda("feira_mensal", casaId, undefined, { dia: "", mercadoId: "" }, id).ok).toBe(false);
  });

  it("mantém o id da agenda existente e guarda o mercado habitual", () => {
    const mercadoId = crypto.randomUUID();
    const r = validarAgenda("mercado_semanal", casaId, existente, { dia: "5", mercadoId }, id);
    expect(r).toMatchObject({ ok: true, agenda: { id: existente.id, mercadoId, diaDaSemana: 5 } });
  });
});
