// Leitura de imagem: QR Code (BarcodeDetector ou jsQR) e OCR da chave impressa (Tesseract).
// As bibliotecas ficam em /vendor e só são carregadas quando precisam.
import { keyFromQR, chaveDoOCR } from './nfce.js';

const url = (p) => new URL(p, document.baseURI).href;

const scripts = new Map();
function carregarScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = url(src);
      s.onload = ok;
      s.onerror = () => falha(new Error(`Não consegui carregar ${src}`));
      document.head.append(s);
    }));
  }
  return scripts.get(src);
}

/** Arquivo de imagem -> canvas, respeitando a rotação da foto e limitando o tamanho. */
export async function arquivoParaCanvas(file, maxLado = 2200) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bmp = await new Promise((ok, falha) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => falha(new Error('Não consegui abrir essa imagem.'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w0 = bmp.width, h0 = bmp.height;
  const esc = Math.min(1, maxLado / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * esc);
  c.height = Math.round(h0 * esc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c;
}

function reduzir(canvas, lado) {
  const esc = lado / Math.max(canvas.width, canvas.height);
  if (esc >= 1) return canvas;
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * esc);
  c.height = Math.round(canvas.height * esc);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

/** Procura um QR Code com chave de NFC-e. Retorna { chave, conteudo } ou null. */
export async function lerQR(origem) {
  // 1) detector nativo (Android/Chrome), quando existe
  if ('BarcodeDetector' in window) {
    try {
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      const achados = await det.detect(origem);
      for (const a of achados) {
        const chave = keyFromQR(a.rawValue);
        if (chave) return { chave, conteudo: a.rawValue };
      }
    } catch { /* cai para o jsQR */ }
  }
  // 2) jsQR (funciona em qualquer navegador, inclusive iPhone)
  await carregarScript('vendor/jsQR.js');
  const base = origem instanceof HTMLCanvasElement ? origem : copiarParaCanvas(origem);
  for (const lado of [1600, 1000, 640]) {
    const c = reduzir(base, lado);
    const dados = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const r = window.jsQR(dados.data, dados.width, dados.height, { inversionAttempts: 'attemptBoth' });
    if (r) {
      const chave = keyFromQR(r.data);
      if (chave) return { chave, conteudo: r.data };
    }
  }
  return null;
}

function copiarParaCanvas(el) {
  const c = document.createElement('canvas');
  c.width = el.videoWidth || el.width;
  c.height = el.videoHeight || el.height;
  c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
  return c;
}

/** Cinza + contraste (e, opcionalmente, preto e branco) para o OCR. */
function prepararOCR(canvas, { larguraAlvo = 1800, binarizar = false } = {}) {
  const esc = larguraAlvo / canvas.width;
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * esc);
  c.height = Math.round(canvas.height * esc);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  const total = c.width * c.height;
  let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.02) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  let limiar = 128;
  if (binarizar) { // Otsu
    const h2 = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.max(0, Math.min(255, Math.round(((d[i] - lo) * 255) / span)));
      h2[g]++;
    }
    let soma = 0; for (let v = 0; v < 256; v++) soma += v * h2[v];
    let sB = 0, wB = 0, melhor = 0;
    for (let v = 0; v < 256; v++) {
      wB += h2[v]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sB += v * h2[v];
      const mB = sB / wB, mF = (soma - sB) / wF;
      const var_ = wB * wF * (mB - mF) * (mB - mF);
      if (var_ > melhor) { melhor = var_; limiar = v; }
    }
  }
  for (let i = 0; i < d.length; i += 4) {
    let g = Math.max(0, Math.min(255, Math.round(((d[i] - lo) * 255) / span)));
    if (binarizar) g = g > limiar ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * OCR da foto para achar a chave de acesso.
 * Retorna o resultado de chaveDoOCR: { exata } | { candidatas } | { vazio, ambiguo? }.
 */
export async function lerChaveDaFoto(canvas, { cnpjsConhecidos = [], aoProgredir = () => {} } = {}) {
  await carregarScript('vendor/tesseract/tesseract.min.js');
  const worker = await window.Tesseract.createWorker('eng', 1, {
    workerPath: url('vendor/tesseract/worker.min.js'),
    corePath: url('vendor/tesseract/core/'),
    langPath: url('vendor/tesseract/lang/'),
    gzip: true,
    logger: (m) => { if (m.status === 'recognizing text') aoProgredir(m.progress); },
  });
  try {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789 ',
      tessedit_pageseg_mode: '6',
      user_defined_dpi: '300',
    });
    const tentativas = [
      { larguraAlvo: 1800, binarizar: false },
      { larguraAlvo: 1800, binarizar: true },
      { larguraAlvo: 2600, binarizar: false },
    ];
    let melhor = { vazio: true };
    for (let i = 0; i < tentativas.length; i++) {
      const { data } = await worker.recognize(prepararOCR(canvas, tentativas[i]));
      const r = chaveDoOCR(data.text, cnpjsConhecidos);
      if (r.exata) return r;
      if (r.candidatas && !melhor.candidatas) melhor = r;
      else if (r.ambiguo && melhor.vazio && !melhor.ambiguo) melhor = r;
    }
    return melhor;
  } finally {
    await worker.terminate();
  }
}
