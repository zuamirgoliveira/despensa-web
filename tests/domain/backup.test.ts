import { describe, expect, it } from "vitest";
import { DIAS_PARA_LEMBRAR_BACKUP, lembreteDeBackup, NOTAS_PARA_LEMBRAR_BACKUP } from "@/domain/backup";

const compra = (importadoEm: string) => ({ importadoEm });
const notas = (n: number, quando: string) => Array.from({ length: n }, () => compra(quando));

describe("lembreteDeBackup", () => {
  it("regras: 30 dias ou 5 notas", () => {
    expect(DIAS_PARA_LEMBRAR_BACKUP).toBe(30);
    expect(NOTAS_PARA_LEMBRAR_BACKUP).toBe(5);
  });

  it("sem compras não há o que perder: nunca lembra", () => {
    expect(lembreteDeBackup({ ultimoBackupEm: undefined, compras: [], hoje: "2026-11-05" })).toBeUndefined();
    expect(lembreteDeBackup({ ultimoBackupEm: "2026-01-01T10:00:00.000Z", compras: [], hoje: "2026-11-05" })).toBeUndefined();
  });

  it("nunca houve cópia e já existe compra: lembra", () => {
    expect(lembreteDeBackup({ ultimoBackupEm: undefined, compras: notas(1, "2026-11-01T10:00:00.000Z"), hoje: "2026-11-05" })).toEqual({
      motivo: "nunca",
      notas: 1,
    });
  });

  it.each([
    // [data da última cópia, hoje, esperado]
    ["2026-10-07T12:00:00.000Z", "2026-11-05", undefined], // 29 dias
    ["2026-10-06T12:00:00.000Z", "2026-11-05", "dias"], // exatamente 30 dias
    ["2026-09-01T12:00:00.000Z", "2026-11-05", "dias"], // 65 dias
    ["2026-11-05T12:00:00.000Z", "2026-11-05", undefined], // hoje
  ])("pelos dias: cópia em %s, hoje %s → %s", (ultimo, hoje, motivo) => {
    const r = lembreteDeBackup({ ultimoBackupEm: ultimo, compras: notas(1, "2026-09-01T10:00:00.000Z"), hoje });
    expect(r?.motivo).toBe(motivo);
  });

  it("pelas notas: 4 desde a última cópia não lembra; 5 lembra; notas antigas não contam", () => {
    const ultimo = "2026-11-01T12:00:00.000Z";
    const antigas = notas(10, "2026-10-20T10:00:00.000Z");
    expect(lembreteDeBackup({ ultimoBackupEm: ultimo, compras: [...antigas, ...notas(4, "2026-11-02T10:00:00.000Z")], hoje: "2026-11-05" })).toBeUndefined();
    expect(lembreteDeBackup({ ultimoBackupEm: ultimo, compras: [...antigas, ...notas(5, "2026-11-02T10:00:00.000Z")], hoje: "2026-11-05" })).toEqual({
      motivo: "notas",
      dias: 4,
      notas: 5,
    });
  });

  it("vale o que ocorrer primeiro: passando nos dois, o motivo é 'dias'", () => {
    const r = lembreteDeBackup({ ultimoBackupEm: "2026-09-01T12:00:00.000Z", compras: notas(8, "2026-10-10T10:00:00.000Z"), hoje: "2026-11-05" });
    expect(r).toMatchObject({ motivo: "dias", notas: 8 });
  });

  it("usa o dia civil de Recife (22h de Recife já é o dia seguinte em UTC)", () => {
    // 05/10 22:00 em Recife (UTC-3) = 06/10 01:00Z: o dia civil de Recife é 05/10, então em 04/11 são 30 dias
    expect(lembreteDeBackup({ ultimoBackupEm: "2026-10-06T01:00:00.000Z", compras: notas(1, "2026-10-01T00:00:00.000Z"), hoje: "2026-11-04" })?.motivo).toBe("dias");
  });

  it("relógio com data da cópia no futuro não lembra por dias", () => {
    expect(lembreteDeBackup({ ultimoBackupEm: "2027-01-01T12:00:00.000Z", compras: notas(1, "2026-10-01T00:00:00.000Z"), hoje: "2026-11-05" })).toBeUndefined();
  });
});
