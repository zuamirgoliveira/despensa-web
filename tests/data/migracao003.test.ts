import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { abrirBanco, criarRepositoriosComBanco } from "@/data/indexeddb";
import { MIGRACOES } from "@/data/indexeddb/migrations";

const put = (db: IDBDatabase, loja: string, v: unknown) =>
  new Promise<void>((ok) => {
    const tx = db.transaction(loja, "readwrite");
    tx.objectStore(loja).put(v);
    tx.oncomplete = () => ok();
  });

describe("migração 003: quantidade numérica e recorrente", () => {
  it("converte estoques por nível e marca produtos existentes como recorrentes", async () => {
    const f = new IDBFactory();
    const casaId = crypto.randomUUID();
    const [p1, p2, p3] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    const antigo = await abrirBanco({ indexedDB: f, nomeBanco: "m", migracoes: MIGRACOES.slice(0, 2) });
    const prod = (id: string, meta: number) => ({
      id, casaId, nome: id, categoria: "outros", unidade: "un", meta, metaManual: false, frequencia: "semanal",
      tipoIda: "mercado_semanal", vidaUtilDias: 90, contavel: false, ativo: true,
    });
    for (const p of [prod(p1, 4), prod(p2, 10), prod(p3, 2)]) await put(antigo, "produtos", p);
    const est = (produtoId: string, nivel: string, extra = {}) => ({ id: crypto.randomUUID(), casaId, produtoId, nivel, confirmadoEm: "2026-11-01T10:00:00Z", ...extra });
    await put(antigo, "estoques", est(p1, "metade"));
    await put(antigo, "estoques", est(p2, "acabou"));
    await put(antigo, "estoques", est(p3, "cheio", { quantidadeExata: 5 }));
    antigo.close();

    const db = await abrirBanco({ indexedDB: f, nomeBanco: "m" });
    const repos = criarRepositoriosComBanco(db);
    expect((await repos.estoques.obterPorProduto(p1))?.quantidade).toBe(2);
    expect((await repos.estoques.obterPorProduto(p2))?.quantidade).toBe(0);
    expect((await repos.estoques.obterPorProduto(p3))?.quantidade).toBe(5);
    expect((await repos.produtos.listar()).every((p) => p.recorrente)).toBe(true);
    db.close();
  });
});
