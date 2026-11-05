/** Preferência de tema (docs/design.md seção 3). Guardada em localStorage; ausente = Sistema. */
export type PreferenciaTema = "sistema" | "claro" | "escuro";

export const CHAVE_TEMA = "despensa-tema";
export const PREFERENCIAS_TEMA: readonly PreferenciaTema[] = ["sistema", "claro", "escuro"];

export function lerPreferencia(armazenamento: Pick<Storage, "getItem"> | undefined): PreferenciaTema {
  try {
    const v = armazenamento?.getItem(CHAVE_TEMA);
    return v === "claro" || v === "escuro" ? v : "sistema";
  } catch {
    return "sistema";
  }
}

/** Grava a preferência e aplica `data-tema` em <html> (Sistema remove o atributo). */
export function salvarPreferencia(pref: PreferenciaTema, doc: Document, armazenamento: Pick<Storage, "setItem" | "removeItem"> | undefined): void {
  try {
    if (pref === "sistema") armazenamento?.removeItem(CHAVE_TEMA);
    else armazenamento?.setItem(CHAVE_TEMA, pref);
  } catch {
    /* armazenamento indisponível: vale só nesta sessão */
  }
  aplicarPreferencia(pref, doc);
}

export function aplicarPreferencia(pref: PreferenciaTema, doc: Document): void {
  if (pref === "sistema") doc.documentElement.removeAttribute("data-tema");
  else doc.documentElement.setAttribute("data-tema", pref);
}
