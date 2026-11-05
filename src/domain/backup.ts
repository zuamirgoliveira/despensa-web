// Lembrete de cópia de segurança (docs/backup.md seção 5). Regra pura: o relógio entra por parâmetro.
import { dataRecife, diasEntre } from "@/lib/datas";
import type { Compra } from "./types";

/** Dias desde a última cópia a partir dos quais o app lembra. */
export const DIAS_PARA_LEMBRAR_BACKUP = 30;
/** Notas importadas desde a última cópia a partir das quais o app lembra. */
export const NOTAS_PARA_LEMBRAR_BACKUP = 5;

export type LembreteBackup = {
  /** `nunca`: já há compras e nenhuma cópia foi feita; `dias`/`notas`: o que estourou primeiro. */
  motivo: "nunca" | "dias" | "notas";
  /** Dias desde a última cópia (não existe em `nunca`). */
  dias?: number;
  /** Notas importadas desde a última cópia (em `nunca`, todas as compras). */
  notas: number;
};

/**
 * Há lembrete quando existe pelo menos uma compra e: nunca houve cópia, ou passaram 30 dias, ou foram
 * importadas 5 notas desde a última cópia (vale o que ocorrer primeiro). Sem compras não há o que perder.
 */
export function lembreteDeBackup(e: {
  ultimoBackupEm: string | undefined;
  compras: readonly Pick<Compra, "importadoEm">[];
  hoje: string;
}): LembreteBackup | undefined {
  if (e.compras.length === 0) return undefined;
  if (!e.ultimoBackupEm) return { motivo: "nunca", notas: e.compras.length };
  const dias = diasEntre(dataRecife(e.ultimoBackupEm), e.hoje);
  const notas = e.compras.filter((c) => c.importadoEm > (e.ultimoBackupEm as string)).length;
  if (dias >= DIAS_PARA_LEMBRAR_BACKUP) return { motivo: "dias", dias, notas };
  if (notas >= NOTAS_PARA_LEMBRAR_BACKUP) return { motivo: "notas", dias, notas };
  return undefined;
}
