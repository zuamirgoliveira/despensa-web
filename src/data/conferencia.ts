// Serviço da conferência rápida: monta a fila e grava cada resposta na hora.
import { selecionarParaConferir, agruparPorLocal, type ProdutoParaConferir } from "@/domain/conferencia";
import { quantidadeDoNivel } from "@/domain/despensa";
import { quantidadeReferencia } from "@/domain/estoque";
import type { Estoque, Nivel, Produto, RegistroConferencia, TipoIda } from "@/domain/types";
import type { Repositorios } from "./repositorios";

/** Fila na ordem de exibição (agrupada por local da casa). `undefined` se o tipo de ida não tem agenda. */
export async function carregarFila(repos: Repositorios, tipo: TipoIda, hoje: string): Promise<ProdutoParaConferir[] | undefined> {
  const casa = await repos.iniciar();
  const [produtos, estoques, compras, agendas, perfil] = await Promise.all([
    repos.produtos.listar(),
    repos.estoques.listar(),
    repos.compras.listar(),
    repos.agendas.listar(),
    repos.perfis.obterDaCasa(casa.id),
  ]);
  const escolhidos = selecionarParaConferir({ tipo, hoje, produtos, estoques, compras, agendas, folgaDias: perfil?.folgaDias ?? 2 });
  return escolhidos && agruparPorLocal(escolhidos).flatMap((g) => g.itens);
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
