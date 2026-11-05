// Armazenamento local (IndexedDB). Tudo fica no aparelho.
const NOME = 'despensa';
const VERSAO = 1;

let _db;
function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((ok, falha) => {
    const req = indexedDB.open(NOME, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('compras', { keyPath: 'chave' });
      db.createObjectStore('mapa', { keyPath: 'k' }); // "cnpj:codigo" -> produto
    };
    req.onsuccess = () => { _db = req.result; ok(_db); };
    req.onerror = () => falha(req.error);
  });
}

async function tx(store, modo, fn) {
  const db = await abrir();
  return new Promise((ok, falha) => {
    const t = db.transaction(store, modo);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => ok(out);
    t.onerror = () => falha(t.error);
    t.onabort = () => falha(t.error);
  });
}

const req = (r) => new Promise((ok, falha) => { r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });

export const compras = {
  todas: () => tx('compras', 'readonly', (s) => req(s.getAll())).then((l) => l.sort((a, b) => b.emissao.localeCompare(a.emissao))),
  obter: (chave) => tx('compras', 'readonly', (s) => req(s.get(chave))),
  salvar: (c) => tx('compras', 'readwrite', (s) => req(s.put(c))),
  apagar: (chave) => tx('compras', 'readwrite', (s) => req(s.delete(chave))),
};

export const mapa = {
  todos: () => tx('mapa', 'readonly', (s) => req(s.getAll())),
  salvar: (k, produto) => tx('mapa', 'readwrite', (s) => req(s.put({ k, produto }))),
};

export async function exportar() {
  return { versao: VERSAO, exportadoEm: new Date().toISOString(), compras: await compras.todas(), mapa: await mapa.todos() };
}

export async function importar(dados) {
  if (!dados || !Array.isArray(dados.compras)) throw new Error('Arquivo de backup inválido.');
  for (const c of dados.compras) await compras.salvar(c);
  for (const m of dados.mapa || []) await mapa.salvar(m.k, m.produto);
  return dados.compras.length;
}
