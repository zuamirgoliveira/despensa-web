import { chaveDoOCR, leituraAproximada, type ResultadoOCR } from "@/domain/nfce/chave";
import { prepararPixels, TENTATIVAS_OCR, type TentativaOCR } from "./preprocessamento";

/** Parte mínima do worker do Tesseract usada aqui (permite simular nos testes). */
export interface WorkerOCR {
  setParameters(p: Record<string, string>): Promise<unknown>;
  recognize(imagem: HTMLCanvasElement): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}

export type DependenciasOCR = {
  criarWorker: (aoProgredir: (p: number) => void) => Promise<WorkerOCR>;
  preparar: (canvas: HTMLCanvasElement, tentativa: TentativaOCR) => HTMLCanvasElement;
};

const BASE = "/vendor/tesseract/";
const url = (p: string): string => new URL(p, location.origin).href;

async function criarWorkerTesseract(aoProgredir: (p: number) => void): Promise<WorkerOCR> {
  const { createWorker } = await import("tesseract.js"); // só carrega quando o OCR é usado
  return createWorker("eng", 1, {
    workerPath: url(`${BASE}worker.min.js`),
    corePath: url(`${BASE}core/`),
    langPath: url(`${BASE}lang/`),
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") aoProgredir(m.progress);
    },
  }) as unknown as Promise<WorkerOCR>;
}

/** Redimensiona para a largura alvo e aplica cinza/contraste (e Otsu, se pedido). */
export function prepararCanvas(canvas: HTMLCanvasElement, { larguraAlvo, binarizar }: TentativaOCR): HTMLCanvasElement {
  const esc = larguraAlvo / canvas.width;
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * esc);
  c.height = Math.round(canvas.height * esc);
  const ctx = c.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  prepararPixels(img.data, binarizar);
  ctx.putImageData(img, 0, 0);
  return c;
}

export type OpcoesOCR = { cnpjsConhecidos?: readonly string[]; aoProgredir?: (p: number) => void };

/**
 * Lê a chave de acesso impressa na foto, no aparelho. Até 3 tentativas de pré-processamento;
 * para na primeira chave exata. Sempre encerra o worker. Nada sai do aparelho.
 */
export async function lerChaveDaFoto(
  canvas: HTMLCanvasElement,
  { cnpjsConhecidos = [], aoProgredir = () => undefined }: OpcoesOCR = {},
  deps: DependenciasOCR = { criarWorker: criarWorkerTesseract, preparar: prepararCanvas },
): Promise<ResultadoOCR> {
  const worker = await deps.criarWorker(aoProgredir);
  try {
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789 ",
      tessedit_pageseg_mode: "6",
      user_defined_dpi: "300",
    });
    let melhor: ResultadoOCR = { vazio: true };
    let aproximada: string | null = null;
    for (const tentativa of TENTATIVAS_OCR) {
      const { data } = await worker.recognize(deps.preparar(canvas, tentativa));
      const r = chaveDoOCR(data.text, cnpjsConhecidos);
      const aprox = leituraAproximada(data.text);
      if (aprox && (aproximada === null || Math.abs(aprox.replace(/ /g, "").length - 44) < Math.abs(aproximada.replace(/ /g, "").length - 44))) aproximada = aprox;
      if ("exata" in r) return r;
      if ("candidatas" in r) {
        if (!("candidatas" in melhor)) melhor = r;
      } else if (r.ambiguo && "vazio" in melhor && !melhor.ambiguo) {
        melhor = r;
      }
    }
    if ("vazio" in melhor && aproximada) return { ...melhor, aproximada };
    return melhor;
  } finally {
    await worker.terminate();
  }
}
