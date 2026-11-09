import type { Migracao } from "./tipos";

/** Fila de QR Codes lidos sem internet, para buscar a nota depois. */
export const migracao004: Migracao = {
  versao: 4,
  nome: "notas-pendentes",
  aplicar(db) {
    db.createObjectStore("notasPendentes", { keyPath: "id" });
  },
};
