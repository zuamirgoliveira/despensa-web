// Service worker manual (sem plugin). Estratégias em AGENTS.md seção 8.
// Alterou rota, asset ou estratégia: incremente VERSAO.
const VERSAO = "despensa-v3";
const PREFIXO = "despensa-";
const TIMEOUT_NAVEGACAO_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith(PREFIXO) && n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function precache() {
  const cache = await caches.open(VERSAO);
  let lista;
  try {
    const r = await fetch("/precache.json", { cache: "no-store" });
    lista = r.ok ? await r.json() : null;
  } catch {
    lista = null;
  }
  // Sem a lista (desenvolvimento): guarda só a página inicial.
  const rotas = lista?.rotas ?? ["/"];
  const arquivos = lista?.arquivos ?? [];
  await cache.addAll(rotas); // rotas são obrigatórias: se falhar, o SW não instala
  await Promise.allSettled(arquivos.map((u) => cache.add(u)));
}

const mesmaOrigem = (url) => url.origin === self.location.origin;
const ehRSC = (req, url) => url.searchParams.has("_rsc") || req.headers.get("RSC") === "1";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!mesmaOrigem(url)) return;
  if (url.pathname === "/sw.js" || url.pathname === "/precache.json") return;

  if (ehRSC(req, url)) {
    // Rede primeiro. Offline: erro, para o Next fazer navegação completa (atendida pelo HTML em cache).
    event.respondWith(fetch(req).catch(() => Response.error()));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(navegacao(req, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/vendor/")) {
    event.respondWith(cachePrimeiro(req));
    return;
  }
  event.respondWith(redePrimeiro(req));
});

async function guardar(chave, resposta) {
  if (!resposta.ok || resposta.type === "opaque") return;
  const cache = await caches.open(VERSAO);
  await cache.put(chave, resposta.clone());
}

async function cachePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const r = await fetch(req);
  await guardar(req, r);
  return r;
}

async function redePrimeiro(req) {
  try {
    const r = await fetch(req);
    await guardar(req, r);
    return r;
  } catch (e) {
    const guardada = await caches.match(req);
    if (guardada) return guardada;
    throw e;
  }
}

// HTML: rede primeiro com limite de tempo (sinal ruim no mercado), cache como reserva.
// A chave do cache é o caminho sem parâmetros: /importar?text=... usa o HTML de /importar.
async function navegacao(req, url) {
  const chave = new Request(url.origin + url.pathname);
  const rede = fetch(req).then(async (r) => {
    await guardar(chave, r);
    return r;
  });
  const cache = await caches.open(VERSAO);
  try {
    return await Promise.race([
      rede,
      new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error("timeout")), TIMEOUT_NAVEGACAO_MS)),
    ]);
  } catch {
    const guardada = await cache.match(chave);
    if (guardada) return guardada;
    return rede; // sem cache: espera a rede (pode lançar, e o navegador mostra o erro dele)
  }
}
