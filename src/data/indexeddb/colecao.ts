import type { z } from "zod";
import { emitirMudanca, type NomeColecao } from "../eventos";
import type { Colecao } from "../repositorios";

export class DadoInvalidoError extends Error {
  constructor(
    public readonly colecao: string,
    detalhe: string,
  ) {
    super(`Registro inválido em "${colecao}": ${detalhe}`);
    this.name = "DadoInvalidoError";
  }
}

export const pedido = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

export const concluida = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transação abortada"));
  });

/** Coleção sobre um object store. Todo dado lido ou gravado passa pelo schema Zod. */
const comoChave = (c: unknown): IDBValidKey => (Array.isArray(c) ? [...c] : (c as IDBValidKey));

export class ColecaoIdb<T, K = string> implements Colecao<T, K> {
  constructor(
    protected readonly db: IDBDatabase,
    protected readonly nome: NomeColecao,
    protected readonly schema: z.ZodType<T>,
  ) {}

  protected ler(valor: unknown): T {
    const r = this.schema.safeParse(valor);
    if (!r.success) throw new DadoInvalidoError(this.nome, r.error.message);
    return r.data;
  }

  async obter(chave: K): Promise<T | undefined> {
    const tx = this.db.transaction(this.nome, "readonly");
    const v = await pedido(tx.objectStore(this.nome).get(comoChave(chave)));
    return v === undefined ? undefined : this.ler(v);
  }

  async listar(): Promise<T[]> {
    const tx = this.db.transaction(this.nome, "readonly");
    const todos = await pedido(tx.objectStore(this.nome).getAll());
    return todos.map((v) => this.ler(v));
  }

  async salvar(item: T): Promise<T> {
    const valido = this.ler(item);
    const tx = this.db.transaction(this.nome, "readwrite");
    tx.objectStore(this.nome).put(valido);
    await concluida(tx);
    emitirMudanca(this.nome);
    return valido;
  }

  async apagar(chave: K): Promise<void> {
    const tx = this.db.transaction(this.nome, "readwrite");
    tx.objectStore(this.nome).delete(comoChave(chave));
    await concluida(tx);
    emitirMudanca(this.nome);
  }

  protected async listarPorIndice(indice: string, valor: IDBValidKey): Promise<T[]> {
    const tx = this.db.transaction(this.nome, "readonly");
    const todos = await pedido(tx.objectStore(this.nome).index(indice).getAll(valor));
    return todos.map((v) => this.ler(v));
  }

  protected async apagarPorIndice(indice: string, valor: IDBValidKey): Promise<void> {
    const tx = this.db.transaction(this.nome, "readwrite");
    const store = tx.objectStore(this.nome);
    const chaves = await pedido(store.index(indice).getAllKeys(valor));
    for (const c of chaves) store.delete(c);
    await concluida(tx);
    emitirMudanca(this.nome);
  }
}
