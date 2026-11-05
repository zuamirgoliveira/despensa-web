export { criarRepositorios } from "./indexeddb";
export { aoMudar, emitirMudanca, COLECOES, type NomeColecao } from "./eventos";
export { exportar, importar, inspecionarBackup, lerBackup, BackupInvalidoError, VERSAO_BACKUP } from "./backup";
export type { InspecaoBackup, OpcoesExportacao, SituacaoIntegridade } from "./backup";
export type * from "./repositorios";
