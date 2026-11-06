// Recorrência: promover um item a "uso contínuo" com pouco atrito (docs/proposta-despensa.md, seção 3).
// Funções puras; nada é aplicado sozinho: o domínio só sugere.
import { diasEntre } from "@/lib/datas";
import { metaAutomatica } from "./catalogo";
import { comprasDoProduto } from "./estoque";
import { passoDaUnidade } from "./lista";
import type { Compra, Produto } from "./types";

/** Compras (notas distintas) a partir das quais o item "parece de uso contínuo". */
export const MIN_COMPRAS_PARA_SUGERIR_RECORRENTE = 3;
/** Dias sem comprar a partir dos quais um recorrente pode sugerir "Deixar de repor". */
export const DIAS_SEM_COMPRA_PARA_SUGERIR_PARAR = 90;

/**
 * Padrão sugerido ao promover: o que o usuário já definiu à mão (`metaManual`), senão a média comprada
 * por nota, senão o `meta` atual. Arredondado ao passo da unidade (mínimo um passo). `undefined` se não há base.
 */
export function padraoSugerido(produto: Pick<Produto, "id" | "meta" | "metaManual" | "unidade">, compras: readonly Compra[]): number | undefined {
  const base = produto.metaManual && produto.meta > 0 ? produto.meta : (metaAutomatica(produto.id, compras) ?? (produto.meta > 0 ? produto.meta : undefined));
  if (base === undefined || base <= 0) return undefined;
  const passo = passoDaUnidade(produto.unidade);
  return Math.max(passo, Math.round(Math.round((base / passo) * 1e6) / 1e6) * passo);
}

export type SugestaoRecorrencia = { acao: "repor_sempre" | "deixar_de_repor"; motivo: string };

/** Não recorrente, ativo e comprado em 3 ou mais notas: "Parece de uso contínuo. Repor sempre?". */
export function sugerirReporSempre(produto: Pick<Produto, "id" | "recorrente" | "ativo">, compras: readonly Compra[]): SugestaoRecorrencia | undefined {
  if (produto.recorrente || !produto.ativo) return undefined;
  const n = comprasDoProduto(produto.id, compras).length;
  return n >= MIN_COMPRAS_PARA_SUGERIR_RECORRENTE ? { acao: "repor_sempre", motivo: `Comprado em ${n} notas. Parece de uso contínuo.` } : undefined;
}

/**
 * Recorrente, ativo, já comprado alguma vez e sem compra há mais de 90 dias: "Deixar de repor?".
 * Item cadastrado à mão e nunca comprado não gera sugestão.
 */
export function sugerirDeixarDeRepor(
  produto: Pick<Produto, "id" | "recorrente" | "ativo">,
  compras: readonly Compra[],
  hoje: string,
): SugestaoRecorrencia | undefined {
  if (!produto.recorrente || !produto.ativo) return undefined;
  const feitas = comprasDoProduto(produto.id, compras);
  if (!feitas.length) return undefined;
  const dias = diasEntre(feitas[feitas.length - 1].data, hoje);
  return dias > DIAS_SEM_COMPRA_PARA_SUGERIR_PARAR ? { acao: "deixar_de_repor", motivo: `Sem compra há ${dias} dias.` } : undefined;
}

/** Produto promovido a recorrente, com o padrão confirmado (ou o sugerido). A meta digitada trava a atualização automática. */
export function promoverARecorrente(produto: Produto, padrao: number | undefined, padraoSugeridoValor: number | undefined): Produto {
  const meta = padrao ?? padraoSugeridoValor ?? produto.meta;
  const editou = padrao !== undefined && padrao !== padraoSugeridoValor;
  return { ...produto, recorrente: true, meta, metaManual: editou ? true : produto.metaManual };
}

/** "Deixar de repor" só tira o item da regra da lista: histórico, quantidade e padrão ficam. */
export function rebaixarDeRecorrente(produto: Produto): Produto {
  return { ...produto, recorrente: false };
}
