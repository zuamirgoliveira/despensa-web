// Gera public/precache.json depois do `next build`: rotas (HTML pré-renderizado) e estáticos do build.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const next = join(raiz, ".next");

function listar(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : [p];
  });
}

const aUrl = (p, base) => "/" + relative(base, p).split(sep).join("/");

const appDir = join(next, "server", "app");
const rotas = listar(appDir)
  .filter((p) => p.endsWith(".html"))
  .map((p) => aUrl(p, appDir).replace(/\.html$/, ""))
  .filter((r) => !/^\/(_not-found|_global-error|404|500)/.test(r))
  .map((r) => (r === "/index" ? "/" : r))
  .sort();

const estaticos = listar(join(next, "static"))
  .filter((p) => !p.endsWith(".map"))
  .map((p) => "/_next/static/" + relative(join(next, "static"), p).split(sep).join("/"))
  .sort();

const publicos = ["/manifest.webmanifest", "/theme-init.js", ...listar(join(raiz, "public", "icons")).map((p) => aUrl(p, join(raiz, "public")))];

if (!rotas.includes("/")) {
  console.error("gen-precache: a rota / não foi encontrada em .next/server/app. O build rodou?");
  process.exit(1);
}

const arquivos = [...publicos, ...estaticos];
const versao = createHash("sha1").update(JSON.stringify([rotas, arquivos])).digest("hex").slice(0, 12);
writeFileSync(join(raiz, "public", "precache.json"), JSON.stringify({ versao, rotas, arquivos }, null, 2) + "\n");
console.log(`gen-precache: ${rotas.length} rotas, ${arquivos.length} arquivos (versão ${versao})`);
