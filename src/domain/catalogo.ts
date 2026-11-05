import { semanaCivil } from "@/lib/datas";
import { LIMITE_PERECIVEL_DIAS, VIDA_UTIL_PADRAO_DIAS } from "@/schemas/constantes";
import { categoriaPorNome } from "./categorias";
import { comprasDoProduto } from "./estoque";
import type { ItemNota } from "./nfce/parser";
import type { Compra, Mercado, Produto } from "./types";

const UNIDADE_DO_PRODUTO: Record<ItemNota["unidade"], Produto["unidade"]> = {
  KG: "kg",
  UNID: "un",
  PCT: "pacote",
  L: "l",
};

/** Produto novo criado a partir de um item de nota (RF-201). */
export function novoProduto(args: {
  id: string;
  casaId: string;
  nome: string;
  item: Pick<ItemNota, "unidade" | "quantidade">;
  mercadoTipo: Mercado["tipo"];
}): Produto {
  const categoria = categoriaPorNome(args.nome, args.mercadoTipo);
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

/** Meta automática: média da quantidade comprada por compra (soma dos itens do produto em cada nota). */
export function metaAutomatica(produtoId: string, compras: readonly Compra[]): number | undefined {
  const feitas = comprasDoProduto(produtoId, compras);
  if (!feitas.length) return undefined;
  const media = feitas.reduce((s, c) => s + c.quantidade, 0) / feitas.length;
  return Math.round(media * 1000) / 1000;
}

export const MIN_IDAS_SEGUIDAS_PARA_SUGERIR_FEIRA = 3;

export type SugestaoCatalogo = { tipoIda: "feira_mensal"; motivo: string };

/**
 * Sugestão (nunca automática): produto durável comprado em 3 ou mais semanas seguidas, que ainda não é
 * de feira mensal, pode virar compra de feira mensal com meta maior.
 */
export function sugestaoDeTipoDeIda(
  produto: Pick<Produto, "id" | "tipoIda" | "vidaUtilDias" | "ativo">,
  compras: readonly Compra[],
): SugestaoCatalogo | undefined {
  if (!produto.ativo || produto.tipoIda === "feira_mensal" || produto.vidaUtilDias <= LIMITE_PERECIVEL_DIAS) return undefined;
  const semanas = [...new Set(comprasDoProduto(produto.id, compras).map((c) => semanaCivil(c.data)))].sort((a, b) => b - a);
  let seguidas = semanas.length ? 1 : 0;
  for (let i = 1; i < semanas.length && semanas[i - 1] - semanas[i] === 1; i++) seguidas++;
  return seguidas >= MIN_IDAS_SEGUIDAS_PARA_SUGERIR_FEIRA
    ? { tipoIda: "feira_mensal", motivo: `Comprado em ${seguidas} semanas seguidas. Vale levar para a feira mensal com meta maior?` }
    : undefined;
}
