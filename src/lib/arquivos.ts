// Arquivos no navegador: compartilhar (menu do Android: Drive, Gmail, WhatsApp...) ou baixar.

export type ResultadoCompartilhar = "compartilhado" | "cancelado" | "indisponivel";

type NavegadorCompartilhar = {
  canShare?: (dados: ShareData) => boolean;
  share?: (dados: ShareData) => Promise<void>;
};

export function criarArquivo(conteudo: string, nome: string, tipo = "application/json"): File {
  return new File([conteudo], nome, { type: tipo });
}

/**
 * Abre o menu de compartilhar com o arquivo. `compartilhado` só diz que a pessoa escolheu um destino
 * (o navegador não informa se o envio terminou). `cancelado`: fechou o menu. `indisponivel`: sem suporte.
 */
export async function compartilharArquivo(
  arquivo: File,
  titulo: string,
  nav: NavegadorCompartilhar | undefined = typeof navigator === "undefined" ? undefined : navigator,
): Promise<ResultadoCompartilhar> {
  if (!nav?.share || !nav.canShare?.({ files: [arquivo] })) return "indisponivel";
  try {
    await nav.share({ files: [arquivo], title: titulo });
    return "compartilhado";
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError" ? "cancelado" : "indisponivel";
  }
}

export function baixarArquivo(arquivo: File, doc: Document = document): void {
  const url = URL.createObjectURL(arquivo);
  const a = doc.createElement("a");
  a.href = url;
  a.download = arquivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
