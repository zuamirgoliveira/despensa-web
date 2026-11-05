// Fechar a compra: atualiza o estoque, reconcilia com a lista e fecha a lista (RF-701 a RF-705).
import { aplicarCompra } from "@/domain/estoque";
import { reconciliar, resumirCompra, type Reconciliacao, type ResumoDaCompra } from "@/domain/reconciliacao";
import type { Compra, Lista } from "@/domain/types";
import type { Repositorios } from "./repositorios";

export type ResultadoFechamento = {
  compra: Compra;
  lista?: Lista;
  reconciliacao?: Reconciliacao;
  resumo?: ResumoDaCompra;
};

/**
 * Depois de salvar a nota: produtos comprados voltam a `cheio` (sempre, com ou sem lista). Com lista
 * aberta: casa os itens (comprado, faltou, fora da lista), grava preço e quantidade pegos, liga a compra
 * à lista e fecha a lista guardando o gasto. Itens que ficaram de fora seguem pendentes e voltam na
 * próxima lista do mesmo tipo.
 */
export async function finalizarCompra(
  repos: Repositorios,
  compra: Compra,
  listaId: string | undefined,
  agora: Date = new Date(),
): Promise<ResultadoFechamento> {
  const estoques = await repos.estoques.listar();
  for (const e of aplicarCompra(estoques, compra, agora.toISOString(), () => crypto.randomUUID())) {
    await repos.estoques.salvar(e);
  }

  const lista = listaId ? await repos.listas.obter(listaId) : undefined;
  if (!lista || (lista.status === "fechada" && compra.listaId !== lista.id)) return { compra };

  const itens = await repos.itensLista.listarPorLista(lista.id);
  const reconciliacao = reconciliar(lista, itens, compra.itens);
  for (const c of reconciliacao.comprados) {
    const quantidade = Math.round(c.itensNota.reduce((s, n) => s + n.quantidade, 0) * 1000) / 1000;
    await repos.itensLista.salvar({
      ...c.item,
      status: c.item.status === "extra" ? "extra" : "pego",
      quantidadePega: quantidade,
      precoCentavos: c.itensNota[0].valorUnitarioCentavos,
    });
  }
  const compraLigada = await repos.compras.salvar({ ...compra, listaId: lista.id });
  const fechada = await repos.listas.salvar({ ...lista, status: "fechada", gastoCentavos: compra.valorTotalCentavos });
  return {
    compra: compraLigada,
    lista: fechada,
    reconciliacao,
    resumo: resumirCompra(reconciliacao, compraLigada, fechada.estimativaCentavos),
  };
}

/** Resumo de uma lista já fechada (recalculado a partir da lista e da compra ligada a ela). */
export async function resumoDaLista(
  repos: Repositorios,
  listaId: string,
): Promise<(ResultadoFechamento & { lista: Lista; reconciliacao: Reconciliacao; resumo: ResumoDaCompra }) | undefined> {
  const lista = await repos.listas.obter(listaId);
  const compra = (await repos.compras.listar()).find((c) => c.listaId === listaId);
  if (!lista || !compra) return undefined;
  const reconciliacao = reconciliar(lista, await repos.itensLista.listarPorLista(listaId), compra.itens);
  return { compra, lista, reconciliacao, resumo: resumirCompra(reconciliacao, compra, lista.estimativaCentavos) };
}

/** Listas em compra (para associar a nota que está sendo importada), a mais recente primeiro. */
export async function listasEmCompra(repos: Repositorios): Promise<Lista[]> {
  return (await repos.listas.listar()).filter((l) => l.status === "em_compra").sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}
