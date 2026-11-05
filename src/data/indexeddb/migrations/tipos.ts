export type Migracao = {
  /** Número da versão do banco que esta migração produz (sequencial, a partir de 1). */
  versao: number;
  nome: string;
  aplicar(db: IDBDatabase, transacao: IDBTransaction): void;
};
