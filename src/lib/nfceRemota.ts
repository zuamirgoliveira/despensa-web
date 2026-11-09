// Cliente do proxy /api/nfce: busca a nota pela URL do QR Code (sem copiar e colar). A resposta é validada com Zod.
import { z } from "zod";
import { notaParseadaSchema, type ResultadoParser } from "@/domain/nfce/parser";

const respostaSchema = z.object({ nota: notaParseadaSchema, avisos: z.array(z.string()), erros: z.array(z.string()) });

const MENSAGENS: Readonly<Record<string, string>> = {
  url_invalida: "O QR Code não é de uma NFC-e de Pernambuco que eu consiga abrir.",
  chave_invalida: "A chave do QR Code não é válida.",
  muitas_consultas: "Muitas consultas seguidas. Espere um minuto e tente de novo.",
  nota_nao_encontrada: "A SEFAZ não devolveu os itens dessa nota.",
  sefaz_indisponivel: "A SEFAZ não respondeu agora.",
  sefaz_demorou: "A SEFAZ demorou demais para responder.",
};

export class BuscaNotaError extends Error {
  /** Problema passageiro (sem rede, SEFAZ fora do ar, limite): vale guardar o QR e tentar depois. */
  constructor(
    mensagem: string,
    public readonly passageiro = false,
  ) {
    super(mensagem);
  }
}

const PASSAGEIROS = new Set(["muitas_consultas", "sefaz_indisponivel", "sefaz_demorou"]);

/** Busca a nota pela URL do QR. Lança `BuscaNotaError` com mensagem para a pessoa; a importação manual segue disponível. */
export async function buscarNotaPeloQR(url: string): Promise<ResultadoParser> {
  let r: Response;
  try {
    r = await fetch("/api/nfce", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
  } catch {
    throw new BuscaNotaError("Sem internet agora.", true);
  }
  const json: unknown = await r.json().catch(() => null);
  if (!r.ok) {
    const codigo = (json as { erro?: string } | null)?.erro ?? "";
    throw new BuscaNotaError(MENSAGENS[codigo] ?? "Não consegui buscar a nota automaticamente.", PASSAGEIROS.has(codigo));
  }
  const v = respostaSchema.safeParse(json);
  if (!v.success) throw new BuscaNotaError("A resposta da busca veio em formato inesperado.");
  return v.data;
}
