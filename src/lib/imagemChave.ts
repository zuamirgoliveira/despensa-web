import type { ResultadoOCR } from "@/domain/nfce/chave";
import { arquivoParaCanvas } from "./imagem";
import { lerChaveDaFoto } from "./ocr";
import { lerQR } from "./qr";

export type LeituraImagem =
  | { tipo: "qr"; chave: string; conteudo: string }
  | { tipo: "ocr"; resultado: ResultadoOCR };

export type EtapaImagem = "abrindo" | "qr" | "ocr";

/** Imagem → QR Code primeiro; se não houver, OCR da chave impressa. Tudo no aparelho. */
export async function lerChaveDeImagem(
  arquivo: Blob,
  opcoes: {
    cnpjsConhecidos: readonly string[];
    aoEtapa: (e: EtapaImagem) => void;
    aoProgredir: (p: number) => void;
    aoPrevia: (dataUrl: string) => void;
  },
): Promise<LeituraImagem> {
  opcoes.aoEtapa("abrindo");
  const canvas = await arquivoParaCanvas(arquivo);
  opcoes.aoPrevia(canvas.toDataURL("image/jpeg", 0.6));
  opcoes.aoEtapa("qr");
  const qr = await lerQR(canvas);
  if (qr) return { tipo: "qr", chave: qr.chave, conteudo: qr.conteudo };
  opcoes.aoEtapa("ocr");
  const resultado = await lerChaveDaFoto(canvas, {
    cnpjsConhecidos: opcoes.cnpjsConhecidos,
    aoProgredir: opcoes.aoProgredir,
  });
  return { tipo: "ocr", resultado };
}
