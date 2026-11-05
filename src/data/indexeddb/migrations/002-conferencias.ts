import type { Migracao } from "./tipos";

/** Registros de conferência da despensa (tempo e quantidade de produtos conferidos). */
export const migracao002: Migracao = {
  versao: 2,
  nome: "conferencias",
  aplicar(db) {
    db.createObjectStore("conferencias", { keyPath: "id" }).createIndex("iniciadaEm", "iniciadaEm");
  },
};
