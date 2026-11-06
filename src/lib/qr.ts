import { keyFromQR } from "@/domain/nfce/chave";
import { reduzirCanvas } from "./imagem";

type DetectorQR = { detect(origem: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorQRCtor = new (opcoes: { formats: string[] }) => DetectorQR;

export type ResultadoQR = { chave: string; conteudo: string };
export type OrigemQR = HTMLVideoElement | HTMLCanvasElement;

const ESCALAS_JSQR = [1600, 1000, 640] as const;

function copiarParaCanvas(el: HTMLVideoElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = el.videoWidth || el.width;
  c.height = el.videoHeight || el.height;
  c.getContext("2d")?.drawImage(el, 0, 0, c.width, c.height);
  return c;
}

/**
 * Procura um QR Code com chave de NFC-e. Usa o detector nativo quando existe; senão (ou se ele
 * não achar) o jsQR em 3 escalas, com `inversionAttempts: 'attemptBoth'`. O jsQR é importado só aqui.
 */
export async function lerQR(origem: OrigemQR): Promise<ResultadoQR | null> {
  const Detector = (globalThis as { BarcodeDetector?: DetectorQRCtor }).BarcodeDetector;
  if (Detector) {
    try {
      const achados = await new Detector({ formats: ["qr_code"] }).detect(origem);
      for (const a of achados) {
        const chave = keyFromQR(a.rawValue);
        if (chave) return { chave, conteudo: a.rawValue };
      }
    } catch {
      // cai para o jsQR
    }
  }
  const { default: jsQR } = await import("jsqr");
  const base = origem instanceof HTMLCanvasElement ? origem : copiarParaCanvas(origem);
  if (!base.width || !base.height) return null;
  for (const lado of ESCALAS_JSQR) {
    const c = reduzirCanvas(base, lado);
    const dados = c.getContext("2d")?.getImageData(0, 0, c.width, c.height);
    if (!dados) continue;
    const r = jsQR(dados.data, dados.width, dados.height, { inversionAttempts: "attemptBoth" });
    if (r) {
      const chave = keyFromQR(r.data);
      if (chave) return { chave, conteudo: r.data };
    }
  }
  return null;
}

/** Estado do foco da câmera: `continuo` (o aparelho foca sozinho), `manual` (só dá para pedir foco pontual) ou `indisponivel`. */
export type ModoFoco = "continuo" | "manual" | "indisponivel";

export type Scanner = {
  parar: () => void;
  /** Como está o foco desta câmera. */
  foco: ModoFoco;
  /** Pede à câmera para refocar agora (toque na imagem). `false` se o aparelho não permite. */
  focar: () => Promise<boolean>;
  /** Foto em resolução máxima da câmera (ImageCapture); sem suporte, o quadro atual do vídeo. */
  fotografar: () => Promise<Blob | undefined>;
};

type TrilhaComFoco = Pick<MediaStreamTrack, "applyConstraints"> & { getCapabilities?: () => object };

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Modos de foco que a câmera declara (`focusMode` em `getCapabilities`). Vazio quando o navegador não informa. */
export function modosDeFoco(trilha: Pick<TrilhaComFoco, "getCapabilities">): string[] {
  const caps = trilha.getCapabilities?.() as { focusMode?: unknown } | undefined;
  const modos = caps?.focusMode;
  return Array.isArray(modos) ? modos.filter((m): m is string => typeof m === "string") : [];
}

const pedirFoco = (trilha: TrilhaComFoco, modo: string): Promise<boolean> =>
  trilha.applyConstraints({ advanced: [{ focusMode: modo } as MediaTrackConstraintSet] }).then(
    () => true,
    () => false,
  );

/**
 * Liga o foco automático contínuo se a câmera declarar suporte. Chrome no Android declara `continuous`;
 * sem declaração (ou sem `getCapabilities`) ainda se tenta uma vez e se confirma pelo resultado.
 */
export async function ligarFocoContinuo(trilha: TrilhaComFoco): Promise<ModoFoco> {
  const modos = modosDeFoco(trilha);
  if (modos.length && !modos.includes("continuous")) return modos.includes("single-shot") ? "manual" : "indisponivel";
  if (await pedirFoco(trilha, "continuous")) return "continuo";
  return modos.includes("single-shot") ? "manual" : "indisponivel";
}

/** Refoca: foco pontual e volta ao contínuo; sem foco pontual, alterna o contínuo para forçar nova varredura. */
export async function refocar(trilha: TrilhaComFoco, modo: ModoFoco): Promise<boolean> {
  if (modo === "indisponivel") return false;
  const modos = modosDeFoco(trilha);
  if (modos.includes("single-shot")) {
    const ok = await pedirFoco(trilha, "single-shot");
    await esperar(1200);
    if (modo === "continuo") await pedirFoco(trilha, "continuous");
    return ok;
  }
  if (modos.includes("manual") && modo === "continuo") {
    await pedirFoco(trilha, "manual");
    await esperar(150);
    return pedirFoco(trilha, "continuous");
  }
  return false;
}

export const INTERVALO_SCANNER_MS = 350;

/**
 * Liga a câmera traseira no `video` e lê um quadro a cada ~350 ms. Ao ler, a câmera é desligada e
 * `aoLer` é chamado. Quem chama deve usar `parar()` ao fechar ou sair da tela.
 * Lança o erro do navegador (ex.: NotAllowedError) se a câmera não puder ser aberta.
 */
export async function iniciarScanner(video: HTMLVideoElement, aoLer: (r: ResultadoQR) => void): Promise<Scanner> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // Sem pedir resolução o Android costuma abrir em 640×480, pouco para o QR pequeno e denso do papel térmico.
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  // Foco contínuo, onde o aparelho permite; o resultado fica no `foco` do Scanner (a tela mostra ao usuário).
  const trilha = stream.getVideoTracks()[0];
  const foco = trilha ? await ligarFocoContinuo(trilha) : "indisponivel";
  let ativo = true;
  let lendo = false;
  const estado: { timer?: ReturnType<typeof setInterval> } = {};

  const parar = (): void => {
    ativo = false;
    if (estado.timer) clearInterval(estado.timer);
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  try {
    await video.play();
  } catch (e) {
    parar();
    throw e;
  }

  estado.timer = setInterval(() => {
    if (!ativo || lendo || video.readyState < 2) return;
    lendo = true;
    lerQR(video)
      .then((r) => {
        if (r && ativo) {
          parar();
          aoLer(r);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        lendo = false;
      });
  }, INTERVALO_SCANNER_MS);

  const focar = async (): Promise<boolean> => (trilha ? refocar(trilha, foco) : false);

  const fotografar = async (): Promise<Blob | undefined> => {
    const IC = (globalThis as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
    if (IC && trilha && ativo) {
      try {
        return await new IC(trilha).takePhoto();
      } catch {
        // cai para o quadro do vídeo
      }
    }
    if (!video.videoWidth) return undefined;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
    return new Promise((ok) => c.toBlob((b) => ok(b ?? undefined), "image/jpeg", 0.95));
  };

  return { parar, foco, focar, fotografar };
}
