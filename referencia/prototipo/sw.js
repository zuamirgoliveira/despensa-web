// Guarda o app no aparelho para abrir sem internet (útil dentro do mercado).
const VERSAO = 'despensa-v2';
const ARQUIVOS = ['./', './index.html', './styles.css', './app.js', './nfce.js', './db.js', './img.js', './vendor/jsQR.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Rede primeiro (pega atualizações), cache se estiver offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
