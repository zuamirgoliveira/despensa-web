// Serviço do modo compra: cada toque persiste na hora (funciona offline e se o app fechar).
import { totalCorrente } from "@/domain/compra";
import type { ItemLista, Lista } from "@/domain/types";
import { agruparLinhas, ajustarEstoque } from "./despensa";
import type { Repositorios } from "./repositorios";

const arred = (n: number): number => Math.max(0, Math.round(n * 1000) / 1000);

/** Fila por item: as alterações de um mesmo item rodam uma de cada vez (leitura + gravação), então nenhuma sobrescreve a outra. */
const filas = new Map<string, Promise<unknown>>();
function emSerie<T>(itemId: string, tarefa: () => Promise<T>): Promise<T> {
  const anterior = filas.get(itemId) ?? Promise.resolve();
  const atual = anterior.then(tarefa, tarefa);
  filas.set(itemId, atual.catch(() => undefined));
  return atual;
}

/**
 * O item como está gravado agora. A tela pode estar com uma cópia antiga (ex.: o preço foi salvo ao sair do campo
 * um instante antes do toque em "Peguei"); gravar a cópia antiga por cima apagaria a edição mais nova.
 */
async function atual(repos: Repositorios, item: ItemLista): Promise<ItemLista> {
  return (await repos.itensLista.obter(item.id)) ?? item;
}

/** Abre a lista para compra: passa a `em_compra` (uma lista fechada não reabre). */
export async function iniciarCompra(repos: Repositorios, listaId: string): Promise<Lista | undefined> {
  const lista = await repos.listas.obter(listaId);
  if (!lista) return undefined;
  if (lista.status === "rascunho") return repos.listas.salvar({ ...lista, status: "em_compra" });
  return lista;
}

/** Peguei: pendente → pego (com a quantidade editada ou a sugerida). Tocar de novo desfaz. */
export function alternarPego(repos: Repositorios, anterior: ItemLista): Promise<ItemLista> {
  return emSerie(anterior.id, async () => {
    const item = await atual(repos, anterior);
    if (item.status === "pego") return repos.itensLista.salvar({ ...item, status: "pendente" });
    return repos.itensLista.salvar({ ...item, status: "pego", quantidadePega: item.quantidadePega ?? item.quantidadeSugerida });
  });
}

/** "Não peguei" (`nao_encontrado`; `adiado` é legado). O item fica faltando e volta pela regra da lista. Tocar de novo no mesmo estado volta a pendente. */
export function marcarEstado(repos: Repositorios, anterior: ItemLista, estado: "nao_encontrado" | "adiado"): Promise<ItemLista> {
  return emSerie(anterior.id, async () => {
    const item = await atual(repos, anterior);
    return repos.itensLista.salvar({ ...item, status: item.status === estado ? "pendente" : estado, quantidadePega: undefined });
  });
}

/** Ajusta a quantidade pega; não muda o status. */
export function definirQuantidadePega(repos: Repositorios, anterior: ItemLista, quantidade: number): Promise<ItemLista> {
  return emSerie(anterior.id, async () => repos.itensLista.salvar({ ...(await atual(repos, anterior)), quantidadePega: arred(quantidade) }));
}

/** Preço unitário opcional (nunca obrigatório); `undefined` limpa. */
export function definirPreco(repos: Repositorios, anterior: ItemLista, precoCentavos: number | undefined): Promise<ItemLista> {
  return emSerie(anterior.id, async () => repos.itensLista.salvar({ ...(await atual(repos, anterior)), precoCentavos }));
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
