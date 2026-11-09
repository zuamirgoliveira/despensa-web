/** Página de consulta pública da NFC-e por UF (hoje só Pernambuco). O app nunca contorna o captcha. */
export const SEFAZ_CONSULTA: Readonly<Record<string, string>> = {
  PE: "https://nfce.sefaz.pe.gov.br/nfce-web/consNfce",
};

const BASE_QR_PE = "https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe";
// p = chave | versão | ambiente | id do CSC | hash (assinatura que o emitente imprime no QR)
const RE_P = /^(\d{44})\|\d\|\d\|\d+\|[0-9A-Fa-f]{40}$/;

/**
 * Valida a URL lida do QR Code da NFC-e de PE e a **reconstrói** só com as partes conhecidas (host fixo,
 * caminho fixo, parâmetro `p` no formato esperado). Qualquer outra URL é recusada: o servidor nunca acessa
 * um endereço escolhido por quem chama. Devolve também a chave de 44 dígitos.
 */
export function consultaDoQR(texto: unknown): { url: string; chave: string } | null {
  let u: URL;
  try {
    u = new URL(String(texto).trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "nfce.sefaz.pe.gov.br" || u.pathname !== "/nfce-web/consultarNFCe") return null;
  if (u.port !== "" && u.port !== "444") return null;
  const p = u.searchParams.get("p");
  const m = p?.match(RE_P);
  if (!p || !m) return null;
  return { url: `${BASE_QR_PE}?p=${p}`, chave: m[1] };
}
