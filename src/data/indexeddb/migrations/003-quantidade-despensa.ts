import { converterEstoqueLegado, type EstoqueLegado } from "@/domain/despensa";
import type { Compra, Produto } from "@/domain/types";
import type { Migracao } from "./tipos";

function todos<T>(tx: IDBTransaction, loja: string): Promise<T[]> {
  return new Promise((ok, erro) => {
    const r = tx.objectStore(loja).getAll();
    r.onsuccess = () => ok(r.result as T[]);
    r.onerror = () => erro(r.error);
  });
}

/**
 * Estoque passa a ter `quantidade` numérica (nível × padrão; `quantidadeExata` prevalece) e todo produto
 * existente vira `recorrente` (já era tratado como de uso contínuo). Ver docs/proposta-despensa.md.
 */
export const migracao003: Migracao = {
  versao: 3,
  nome: "quantidade-despensa",
  aplicar(_db, transacao) {
    void (async () => {
      const [estoques, produtos, compras] = await Promise.all([
        todos<EstoqueLegado>(transacao, "estoques"),
        todos<Produto>(transacao, "produtos"),
        todos<Compra>(transacao, "compras"),
      ]);
      const porId = new Map(produtos.map((p) => [p.id, p]));
      for (const e of estoques) transacao.objectStore("estoques").put(converterEstoqueLegado(e, porId.get(e.produtoId), compras));
      for (const p of produtos) if (p.recorrente === undefined) transacao.objectStore("produtos").put({ ...p, recorrente: true });
    })().catch(() => transacao.abort());
  },
};
