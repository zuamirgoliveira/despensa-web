// Serviço do modo compra: cada toque persiste na hora (funciona offline e se o app fechar).
import { totalCorrente } from "@/domain/compra";
import type { ItemLista, Lista } from "@/domain/types";
import { agruparLinhas, ajustarEstoque } from "./despensa";
import type { Repositorios } from "./repositorios";

const arred = (n: number): number => Math.max(0, Math.round(n * 1000) / 1000);

/** Abre a lista para compra: passa a `em_compra` (uma lista fechada não reabre). */
export async function iniciarCompra(repos: Repositorios, listaId: string): Promise<Lista | undefined> {
  const lista = await repos.listas.obter(listaId);
  if (!lista) return undefined;
  if (lista.status === "rascunho") return repos.listas.salvar({ ...lista, status: "em_compra" });
  return lista;
}

/** Peguei: pendente → pego (com a quantidade editada ou a sugerida). Tocar de novo desfaz. */
export async function alternarPego(repos: Repositorios, item: ItemLista): Promise<ItemLista> {
  if (item.status === "pego") return repos.itensLista.salvar({ ...item, status: "pendente" });
  return repos.itensLista.salvar({ ...item, status: "pego", quantidadePega: item.quantidadePega ?? item.quantidadeSugerida });
}

/** "Não encontrei" (volta na próxima ida) e "Adiar". Tocar de novo no mesmo estado volta a pendente. */
export async function marcarEstado(repos: Repositorios, item: ItemLista, estado: "nao_encontrado" | "adiado"): Promise<ItemLista> {
  return repos.itensLista.salvar({ ...item, status: item.status === estado ? "pendente" : estado, quantidadePega: undefined });
}

/** Ajusta a quantidade pega; não muda o status. */
export async function definirQuantidadePega(repos: Repositorios, item: ItemLista, quantidade: number): Promise<ItemLista> {
  return repos.itensLista.salvar({ ...item, quantidadePega: arred(quantidade) });
}

/** Preço unitário opcional (nunca obrigatório); `undefined` limpa. */
export async function definirPreco(repos: Repositorios, item: ItemLista, precoCentavos: number | undefined): Promise<ItemLista> {
  return repos.itensLista.salvar({ ...item, precoCentavos });
}

export async function removerDaCompra(repos: Repositorios, item: ItemLista): Promise<void> {
  if (item.produtoId) await repos.itensLista.salvar({ ...item, removido: true });
  else await repos.itensLista.apagar(item.id);
}

/** Extra comprado fora da lista: já entra como pego. */
export async function adicionarExtra(
  repos: Repositorios,
  lista: Lista,
  nome: string,
  quantidade: number,
  precoCentavos?: number,
): Promise<ItemLista> {
  return repos.itensLista.salvar({
    id: crypto.randomUUID(), casaId: lista.casaId, listaId: lista.id, nomeAvulso: nome.trim(), quantidadeSugerida: quantidade,
    quantidadePega: quantidade, status: "extra", precoCentavos, motivo: "manual", urgente: false, removido: false, quantidadeEditada: true,
  });
}

export async function definirOrcamento(repos: Repositorios, lista: Lista, orcamentoCentavos: number | undefined): Promise<Lista> {
  return repos.listas.salvar({ ...lista, orcamentoCentavos });
}

/**
 * "Terminar sem nota": o que foi pego (pego ou extra, com produto) **soma** à despensa e a lista fecha com o total
 * corrente como gasto. Só para compras sem nota: importar depois a nota desta mesma compra somaria de novo.
 */
export async function terminarSemNota(repos: Repositorios, listaId: string, agora: Date = new Date()): Promise<{ produtos: number } | undefined> {
  const lista = await repos.listas.obter(listaId);
  if (!lista || lista.status === "fechada") return undefined;
  const itens = await repos.itensLista.listarPorLista(listaId);
  const pegos = itens.filter((i) => !i.removido && (i.status === "pego" || i.status === "extra"));
  const linhas = agruparLinhas(pegos.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidadePega ?? i.quantidadeSugerida })));
  const produtos = await ajustarEstoque(repos, linhas, 1, agora);
  await repos.listas.salvar({ ...lista, status: "fechada", gastoCentavos: totalCorrente(itens) });
  return { produtos };
}
