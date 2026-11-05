import { VIDA_UTIL_PADRAO_DIAS } from "@/schemas/constantes";
import type { ItemNota } from "./nfce/parser";
import type { Categoria, Mercado, Produto } from "./types";

const UNIDADE_DO_PRODUTO: Record<ItemNota["unidade"], Produto["unidade"]> = {
  KG: "kg",
  UNID: "un",
  PCT: "pacote",
  L: "l",
};

/** Categoria inicial: hortifruti pelo tipo do mercado; o resto fica em "outros" (refinado na C-21). */
export function categoriaInicial(mercadoTipo: Mercado["tipo"]): Categoria {
  return mercadoTipo === "hortifruti" ? "hortifruti" : "outros";
}

/** Produto novo criado a partir de um item de nota (RF-201). */
export function novoProduto(args: {
  id: string;
  casaId: string;
  nome: string;
  item: Pick<ItemNota, "unidade" | "quantidade">;
  mercadoTipo: Mercado["tipo"];
}): Produto {
  const categoria = categoriaInicial(args.mercadoTipo);
  return {
    id: args.id,
    casaId: args.casaId,
    nome: args.nome.trim(),
    categoria,
    unidade: UNIDADE_DO_PRODUTO[args.item.unidade],
    meta: args.item.quantidade,
    metaManual: false,
    frequencia: "semanal",
    tipoIda: categoria === "hortifruti" ? "hortifruti_semanal" : "mercado_semanal",
    vidaUtilDias: VIDA_UTIL_PADRAO_DIAS[categoria],
    contavel: false,
    ativo: true,
  };
}

/** Chave para comparar nomes de produto sem diferença de caixa, acento ou espaços. */
export function chaveDeNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
