import type { Mercado } from "./types";

/** Tipo sugerido pelo nome do emitente (editável pelo usuário). */
export function sugerirTipoMercado(nome: string): Mercado["tipo"] {
  const n = nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (/hortifruti|sacolao|hortigranjeiro/.test(n)) return "hortifruti";
  if (/atacado|atacarejo|atacadista/.test(n)) return "atacarejo";
  return "supermercado";
}
