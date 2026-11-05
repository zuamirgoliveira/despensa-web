export { criarRepositorios } from "./indexeddb";
export { aoMudar, emitirMudanca, COLECOES, type NomeColecao } from "./eventos";
export { compararComAparelho, exportar, importar, inspecionarBackup, lerBackup, restaurarBackup, BackupInvalidoError, VERSAO_BACKUP } from "./backup";
export type { ComparacaoAparelho, ContagemComparada, InspecaoBackup, OpcoesExportacao, SituacaoIntegridade } from "./backup";
export type * from "./repositorios";
