// Serviço da conferência rápida: monta a fila e grava cada resposta na hora.
import { selecionarParaRevisar, agruparPorLocal, type ProdutoParaConferir } from "@/domain/conferencia";
import { quantidadeDoNivel } from "@/domain/despensa";
import { quantidadeReferencia } from "@/domain/estoque";
import type { Estoque, Nivel, Produto, RegistroConferencia } from "@/domain/types";
import type { Repositorios } from "./repositorios";

/** Fila da revisão na ordem de exibição (agrupada por local da casa). */
export async function carregarFila(repos: Repositorios, hoje: string): Promise<ProdutoParaConferir[]> {
  await repos.iniciar();
  const [produtos, estoques, compras] = await Promise.all([repos.produtos.listar(), repos.estoques.listar(), repos.compras.listar()]);
  return agruparPorLocal(selecionarParaRevisar({ hoje, produtos, estoques, compras })).flatMap((g) => g.itens);
}

/** Grava (ou atualiza) o nível do produto agora. Cada resposta persiste na hora, mesmo se o usuário sair. */
export async function registrarNivel(
  repos: Repositorios,
  produto: Pick<Produto, "id" | "casaId" | "meta">,
  nivel: Nivel,
  agora: Date,
  quantidadeExata?: number,
): Promise<Estoque & { ruptura: boolean }> {
  const atual = await repos.estoques.obterPorProduto(produto.id);
  const compras = quantidadeExata === undefined && produto.meta <= 0 ? await repos.compras.listar() : [];
  const ruptura = nivel === "acabou" && atual?.nivel !== "acabou";
  const salvo = await repos.estoques.salvar({
    ...(atual ?? { id: crypto.randomUUID(), casaId: produto.casaId, produtoId: produto.id }),
    nivel,
    quantidade: quantidadeExata ?? quantidadeDoNivel(nivel, quantidadeReferencia(produto, compras)),
    quantidadeExata,
    confirmadoEm: agora.toISOString(),
  });
  return { ...salvo, ruptura };
}

export async function registrarConferencia(
  repos: Repositorios,
  r: Omit<RegistroConferencia, "id" | "casaId" | "rupturas"> & { rupturas?: number },
): Promise<RegistroConferencia> {
  const casa = await repos.iniciar();
  return repos.conferencias.salvar({ id: crypto.randomUUID(), casaId: casa.id, ...r, rupturas: r.rupturas ?? 0 });
}
