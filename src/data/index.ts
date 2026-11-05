export { criarRepositorios } from "./indexeddb";
export { aoMudar, emitirMudanca, COLECOES, type NomeColecao } from "./eventos";
export { exportar, importar, lerBackup, BackupInvalidoError, VERSAO_BACKUP } from "./backup";
export type * from "./repositorios";
