/** "6,49" ou "1.234,50" → centavos inteiros. Vazio ou inválido → undefined. */
export function reaisParaCentavos(texto: string): number | undefined {
  const t = texto.trim();
  if (t === "") return undefined;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

/** centavos → "6,49" (campo de formulário, sem símbolo). */
export function centavosParaCampo(centavos: number | undefined): string {
  return centavos === undefined ? "" : (centavos / 100).toFixed(2).replace(".", ",");
}
