// Pré-processamento de imagem para OCR. Funções puras sobre pixels RGBA (testáveis sem navegador).

/** Converte para cinza e estica o contraste (percentis 2% e 98%). Com `binarizar`, aplica Otsu. Altera `d`. */
export function prepararPixels(d: Uint8ClampedArray, binarizar: boolean): void {
  const total = d.length / 4;
  if (total === 0) return;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      hi = v;
      break;
    }
  }
  const span = Math.max(1, hi - lo);
  const esticar = (g: number): number => Math.max(0, Math.min(255, Math.round(((g - lo) * 255) / span)));

  let limiar = 128;
  if (binarizar) {
    const h2 = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) h2[esticar(d[i])]++;
    limiar = limiarOtsu(h2, total);
  }
  for (let i = 0; i < d.length; i += 4) {
    let g = esticar(d[i]);
    if (binarizar) g = g > limiar ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
}

/** Limiar de Otsu sobre um histograma de 256 níveis. */
export function limiarOtsu(hist: Uint32Array, total: number): number {
  let soma = 0;
  for (let v = 0; v < 256; v++) soma += v * hist[v];
  let sB = 0;
  let wB = 0;
  let melhor = 0;
  let limiar = 128;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sB += v * hist[v];
    const mB = sB / wB;
    const mF = (soma - sB) / wF;
    const variancia = wB * wF * (mB - mF) * (mB - mF);
    if (variancia > melhor) {
      melhor = variancia;
      limiar = v;
    }
  }
  return limiar;
}

export type TentativaOCR = { larguraAlvo: number; binarizar: boolean };

/** Ordem das tentativas (AGENTS.md 7.6): cinza/contraste 1800, Otsu 1800, cinza/contraste 2600. */
export const TENTATIVAS_OCR: readonly TentativaOCR[] = [
  { larguraAlvo: 1800, binarizar: false },
  { larguraAlvo: 1800, binarizar: true },
  { larguraAlvo: 2600, binarizar: false },
];
