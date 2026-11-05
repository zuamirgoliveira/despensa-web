import { migracao001 } from "./001-inicial";
import { migracao002 } from "./002-conferencias";
import type { Migracao } from "./tipos";

/** Em ordem crescente e sem lacunas. Para mudar o schema, acrescentar NNN-descricao.ts aqui. */
export const MIGRACOES: readonly Migracao[] = [migracao001, migracao002];

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
