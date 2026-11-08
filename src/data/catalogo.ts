// Operações do catálogo que envolvem vários repositórios: edição com meta manual e mesclagem.
import type { Produto } from "@/domain/types";
import { atualizarMetasAutomaticas } from "./importarNota";
import type { Repositorios } from "./repositorios";

/** Salva a edição de um produto. Mudar a meta à mão trava a atualização automática (`metaManual`). */
export async function salvarProdutoEditado(repos: Repositorios, original: Produto, novo: Produto): Promise<Produto> {
  const metaMudou = novo.meta !== original.meta;
  return repos.produtos.salvar({ ...novo, metaManual: novo.metaManual || metaMudou });
}

/** Devolve a meta ao cálculo automático (média das compras). */
export async function liberarMetaAutomatica(repos: Repositorios, produtoId: string): Promise<void> {
  const p = await repos.produtos.obter(produtoId);
  if (!p) return;
  await repos.produtos.salvar({ ...p, metaManual: false });
  await atualizarMetasAutomaticas(repos, [produtoId]);
}

export class MesclagemInvalidaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "MesclagemInvalidaError";
  }
}

/**
 * Mescla `origemId` em `destinoId`: apelidos, itens de compra, itens de lista e estoque passam a apontar
 * para o destino (o histórico de preços é mantido) e o produto de origem é apagado.
 */
export async function mesclarProdutos(repos: Repositorios, origemId: string, destinoId: string): Promise<Produto> {
  if (origemId === destinoId) throw new MesclagemInvalidaError("Escolha dois produtos diferentes.");
  const [origem, destino] = await Promise.all([repos.produtos.obter(origemId), repos.produtos.obter(destinoId)]);
  if (!origem || !destino) throw new MesclagemInvalidaError("Produto não encontrado.");

  for (const a of await repos.apelidos.listarPorProduto(origemId)) {
    await repos.apelidos.salvar({ ...a, produtoId: destinoId });
  }
  for (const c of await repos.compras.listar()) {
    if (c.itens.some((i) => i.produtoId === origemId)) {
      await repos.compras.salvar({ ...c, itens: c.itens.map((i) => (i.produtoId === origemId ? { ...i, produtoId: destinoId } : i)) });
    }
  }
  for (const i of await repos.itensLista.listar()) {
    if (i.produtoId === origemId) await repos.itensLista.salvar({ ...i, produtoId: destinoId });
  }
  const estoqueOrigem = await repos.estoques.obterPorProduto(origemId);
  if (estoqueOrigem) {
    const estoqueDestino = await repos.estoques.obterPorProduto(destinoId);
    await repos.estoques.apagar(estoqueOrigem.id);
    if (!estoqueDestino) {
      await repos.estoques.salvar({ ...estoqueOrigem, produtoId: destinoId });
    } else {
      // os dois produtos eram o mesmo: o que havia em cada um soma (Coca 1 + Coca 1 = 2)
      const quantidade = Math.round((estoqueDestino.quantidade + estoqueOrigem.quantidade) * 1000) / 1000;
      const confirmadoEm = estoqueOrigem.confirmadoEm > estoqueDestino.confirmadoEm ? estoqueOrigem.confirmadoEm : estoqueDestino.confirmadoEm;
      await repos.estoques.salvar({ ...estoqueDestino, quantidade, quantidadeExata: undefined, confirmadoEm });
    }
  }
  await repos.produtos.apagar(origemId);
  await atualizarMetasAutomaticas(repos, [destinoId]);
  return (await repos.produtos.obter(destinoId)) as Produto;
}
