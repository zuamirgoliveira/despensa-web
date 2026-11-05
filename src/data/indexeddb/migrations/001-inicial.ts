import type { Migracao } from "./tipos";

/** Cria todas as coleções e índices. Nunca editar depois de publicada: criar a 002. */
export const migracao001: Migracao = {
  versao: 1,
  nome: "inicial",
  aplicar(db) {
    db.createObjectStore("casas", { keyPath: "id" });
    db.createObjectStore("perfis", { keyPath: "id" }).createIndex("casaId", "casaId");
    db.createObjectStore("agendas", { keyPath: "id" }).createIndex("casaId", "casaId");
    db.createObjectStore("mercados", { keyPath: "id" }).createIndex("cnpj", "cnpj");
    db.createObjectStore("produtos", { keyPath: "id" }).createIndex("nome", "nome");
    const apelidos = db.createObjectStore("apelidos", { keyPath: ["cnpj", "codigo"] });
    apelidos.createIndex("cnpj", "cnpj");
    apelidos.createIndex("produtoId", "produtoId");
    db.createObjectStore("estoques", { keyPath: "id" }).createIndex("produtoId", "produtoId", { unique: true });
    const compras = db.createObjectStore("compras", { keyPath: "chave" });
    compras.createIndex("emissao", "emissao");
    compras.createIndex("mercadoId", "mercadoId");
    db.createObjectStore("listas", { keyPath: "id" }).createIndex("data", "data");
    db.createObjectStore("itensLista", { keyPath: "id" }).createIndex("listaId", "listaId");
  },
};
