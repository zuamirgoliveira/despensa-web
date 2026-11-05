// Copia worker, core e idioma do Tesseract para public/vendor/tesseract (não versionado).
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => join(raiz, "node_modules", ...p);
const destino = join(raiz, "public", "vendor", "tesseract");

const arquivos = [
  [nm("tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  [nm("tesseract.js-core", "tesseract-core-lstm.wasm.js"), "core/tesseract-core-lstm.wasm.js"],
  [nm("tesseract.js-core", "tesseract-core-simd-lstm.wasm.js"), "core/tesseract-core-simd-lstm.wasm.js"],
  [nm("@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), "lang/eng.traineddata.gz"],
];

try {
  for (const [origem, rel] of arquivos) {
    if (!existsSync(origem)) throw new Error(`arquivo não encontrado: ${origem}. Rode "npm ci".`);
    const alvo = join(destino, rel);
    mkdirSync(dirname(alvo), { recursive: true });
    copyFileSync(origem, alvo);
    if (statSync(alvo).size === 0) throw new Error(`cópia vazia: ${alvo}`);
  }
  console.log(`copy-vendor: ${arquivos.length} arquivos em public/vendor/tesseract`);
} catch (e) {
  console.error(`copy-vendor FALHOU: ${e.message}`);
  process.exit(1);
}
