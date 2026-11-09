import { migracao001 } from "./001-inicial";
import { migracao002 } from "./002-conferencias";
import { migracao003 } from "./003-quantidade-despensa";
import { migracao004 } from "./004-notas-pendentes";
import type { Migracao } from "./tipos";

/** Em ordem crescente e sem lacunas. Para mudar o schema, acrescentar NNN-descricao.ts aqui. */
export const MIGRACOES: readonly Migracao[] = [migracao001, migracao002, migracao003, migracao004];

export const VERSAO_BANCO = MIGRACOES[MIGRACOES.length - 1].versao;

export function aplicarMigracoes(
  db: IDBDatabase,
  transacao: IDBTransaction,
  versaoAnterior: number,
  migracoes: readonly Migracao[] = MIGRACOES,
): void {
  for (const m of migracoes) {
    if (m.versao > versaoAnterior) m.aplicar(db, transacao);
  }
}
