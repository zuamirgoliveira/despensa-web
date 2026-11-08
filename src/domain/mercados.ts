import type { Mercado } from "./types";

/** Tipo sugerido pelo nome do emitente (editável pelo usuário). */
export function sugerirTipoMercado(nome: string): Mercado["tipo"] {
  const n = nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (/hortifruti|sacolao|hortigranjeiro/.test(n)) return "hortifruti";
  if (/atacado|atacarejo|atacadista/.test(n)) return "atacarejo";
  if (/padaria|panificadora|confeitaria/.test(n)) return "padaria";
  if (/acougue|casa de carnes|frigorifico/.test(n)) return "acougue";
  if (/farmacia|drogaria|drogasil|pague menos/.test(n)) return "farmacia";
  if (/lanchonete|restaurante|pizzaria|pizza|bar e|sorveteria/.test(n)) return "lanchonete";
  return "supermercado";
}
