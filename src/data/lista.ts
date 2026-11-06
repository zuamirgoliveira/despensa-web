// Serviço da lista de compras: lista única da casa, regeração preservando edições e edição de itens.
import { gerarListaDaCasa } from "@/domain/despensa";
import { mesclarRegeracao, estimarCusto } from "@/domain/lista";
import type { ItemLista, Lista } from "@/domain/types";
import type { Repositorios } from "./repositorios";

/**
 * Lista única da casa (`gerarListaDaCasa`: recorrentes zerados ou abaixo do padrão). Reaproveita a lista aberta
 * mais antiga (rascunho ou em compra) ou cria uma; regerar preserva as edições manuais (removidos continuam removidos,
 * quantidades editadas permanecem, avulsos, extras e já pegos nunca são tocados). O `tipoIda` gravado é só
 * um valor de compatibilidade: a lista não depende de agenda.
 */
export async function garantirListaDaCasa(repos: Repositorios, hoje: string, agora: Date = new Date()): Promise<{ lista: Lista; naoRecorrentesZerados: string[] }> {
  const casa = await repos.iniciar();
  const [produtos, estoques, compras, listas] = await Promise.all([repos.produtos.listar(), repos.estoques.listar(), repos.compras.listar(), repos.listas.listar()]);
  const gerada = gerarListaDaCasa({ produtos, estoques, compras });

  // Só existe uma lista: a que está em compra (a mais recente) ou, sem ela, o rascunho mais antigo. As outras listas
  // abertas são do modelo antigo (uma por ida, ou dividida entre mercados) e são fechadas, para não interferirem.
  const abertas = listas.filter((l) => l.status !== "fechada");
  const emCompra = abertas.filter((l) => l.status === "em_compra").sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))[0];
  const escolhida = emCompra ?? abertas.sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))[0];
  for (const l of abertas) if (l.id !== escolhida?.id) await repos.listas.salvar({ ...l, status: "fechada" });
  const sugeridos = gerada.itens;

  const base =
    escolhida ??
    (await repos.listas.salvar({ id: crypto.randomUUID(), casaId: casa.id, tipoIda: "mercado_semanal", data: hoje, status: "rascunho", criadaEm: agora.toISOString() }));
  const lista = base.status === "rascunho" && base.data !== hoje ? await repos.listas.salvar({ ...base, data: hoje }) : base;

  const atuais = await repos.itensLista.listarPorLista(lista.id);
  const m = mesclarRegeracao(sugeridos, atuais);
  for (const s of m.adicionar) {
    await repos.itensLista.salvar({
      id: crypto.randomUUID(), casaId: casa.id, listaId: lista.id, produtoId: s.produtoId, quantidadeSugerida: s.quantidade,
      status: "pendente", motivo: s.motivo, urgente: false, removido: false, quantidadeEditada: false,
    });
  }
  const porId = new Map(atuais.map((i) => [i.id, i]));
  for (const u of m.atualizar) {
    const i = porId.get(u.id) as ItemLista;
    await repos.itensLista.salvar({ ...i, quantidadeSugerida: u.quantidadeSugerida, motivo: u.motivo, urgente: false });
  }
  for (const id of m.remover) await repos.itensLista.apagar(id);

  const itens = await repos.itensLista.listarPorLista(lista.id);
  const salva = await repos.listas.salvar({ ...lista, estimativaCentavos: estimarCusto(itens, compras).totalCentavos });
  return { lista: salva, naoRecorrentesZerados: gerada.naoRecorrentesZerados };
}

/** Define a quantidade à mão: a edição passa a ser preservada ao regerar. */
export async function alterarQuantidade(repos: Repositorios, item: ItemLista, quantidade: number): Promise<ItemLista> {
  return repos.itensLista.salvar({ ...item, quantidadeSugerida: Math.max(0, Math.round(quantidade * 1000) / 1000), quantidadeEditada: true });
}

/** Item da lista (produto do catálogo) fica marcado como removido para não voltar ao regerar; avulso é apagado. */
export async function removerItem(repos: Repositorios, item: ItemLista): Promise<void> {
  if (item.produtoId) await repos.itensLista.salvar({ ...item, removido: true });
  else await repos.itensLista.apagar(item.id);
}

export async function restaurarItem(repos: Repositorios, item: ItemLista): Promise<ItemLista> {
  return repos.itensLista.salvar({ ...item, removido: false });
}

export async function adicionarAvulso(repos: Repositorios, lista: Lista, nome: string, quantidade: number): Promise<ItemLista> {
  return repos.itensLista.salvar({
    id: crypto.randomUUID(), casaId: lista.casaId, listaId: lista.id, nomeAvulso: nome.trim(), quantidadeSugerida: quantidade,
    status: "pendente", motivo: "manual", urgente: false, removido: false, quantidadeEditada: true,
  });
}
