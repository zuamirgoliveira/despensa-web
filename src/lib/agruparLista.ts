import type { ItemLista, Mercado, Produto } from "@/domain/types";
import { CATEGORIAS } from "@/schemas";
import { CATEGORIA_ROTULO } from "./rotulos";

export type ItemVisao = { item: ItemLista; produto?: Produto };
export type GrupoLista = { titulo: string; itens: ItemVisao[] };

const nomeDe = (v: ItemVisao): string => v.produto?.nome ?? v.item.nomeAvulso ?? "";
const porNome = (a: ItemVisao, b: ItemVisao): number => nomeDe(a).localeCompare(nomeDe(b), "pt-BR");

export const TITULO_AVULSOS = "Avulsos";
export const TITULO_SEM_MERCADO = "Sem mercado preferido";

/** Grupos por categoria na ordem do catálogo; itens avulsos (fora do catálogo) por último. */
export function agruparPorCategoria(itens: readonly ItemVisao[]): GrupoLista[] {
  const grupos: GrupoLista[] = CATEGORIAS.map((c) => ({
    titulo: CATEGORIA_ROTULO[c],
    itens: itens.filter((v) => v.produto?.categoria === c).sort(porNome),
  }));
  grupos.push({ titulo: TITULO_AVULSOS, itens: itens.filter((v) => !v.produto).sort(porNome) });
  return grupos.filter((g) => g.itens.length);
}

/** Grupos por mercado preferido do produto (visual; não divide a lista). Sem preferido ou avulso: "Sem mercado preferido". */
export function agruparPorMercado(itens: readonly ItemVisao[], mercados: readonly Mercado[]): GrupoLista[] {
  const nomeMercado = new Map(mercados.map((m) => [m.id, m.apelido || m.nome]));
  const mapa = new Map<string, ItemVisao[]>();
  for (const v of itens) {
    const titulo = (v.produto?.mercadoPreferidoId && nomeMercado.get(v.produto.mercadoPreferidoId)) || TITULO_SEM_MERCADO;
    mapa.set(titulo, [...(mapa.get(titulo) ?? []), v]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === TITULO_SEM_MERCADO ? 1 : b === TITULO_SEM_MERCADO ? -1 : a.localeCompare(b, "pt-BR")))
    .map(([titulo, lista]) => ({ titulo, itens: lista.sort(porNome) }));
}

/** Há mais de um mercado preferido diferente entre os itens (só então vale oferecer a separação). */
export function temMercadosDiferentes(itens: readonly ItemVisao[]): boolean {
  return new Set(itens.map((v) => v.produto?.mercadoPreferidoId).filter(Boolean)).size > 1;
}
