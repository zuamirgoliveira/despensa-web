// Serviço da lista de compras: lista da casa, regeração preservando edições, edição de itens e divisão entre mercados.
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

  // Depois de dividir pode haver duas listas abertas: a regeração é da original (a mais antiga).
  const abertas = listas.filter((l) => l.status !== "fechada").sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
  const irmaos = new Set<string>();
  for (const l of abertas.slice(1)) for (const i of await repos.itensLista.listarPorLista(l.id)) if (i.produtoId && !i.removido) irmaos.add(i.produtoId);
  const sugeridos = gerada.itens.filter((i) => !irmaos.has(i.produtoId));

  const base =
    abertas[0] ??
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

/**
 * Divide a lista entre o mercado habitual e um alternativo: cria uma segunda lista (mesma ida, `mercadoId`
 * do alternativo) e move para ela os itens indicados. Nenhum item se perde.
 */
export async function dividirLista(
  repos: Repositorios,
  lista: Lista,
  habitualId: string,
  alternativoId: string,
  produtoIds: readonly string[],
  agora: Date = new Date(),
): Promise<{ original: Lista; nova: Lista }> {
  const mover = new Set(produtoIds);
  // A nova lista é sempre posterior à original (a regeração usa a mais antiga), mesmo no mesmo milissegundo.
  const criadaEm = new Date(Math.max(agora.getTime(), new Date(lista.criadaEm).getTime() + 1)).toISOString();
  const nova = await repos.listas.salvar({
    id: crypto.randomUUID(), casaId: lista.casaId, tipoIda: lista.tipoIda, data: lista.data, status: "rascunho", mercadoId: alternativoId, criadaEm,
  });
  for (const i of await repos.itensLista.listarPorLista(lista.id)) {
    if (!i.removido && i.produtoId && mover.has(i.produtoId)) await repos.itensLista.salvar({ ...i, listaId: nova.id });
  }
  const compras = await repos.compras.listar();
  const estimar = async (l: Lista): Promise<Lista> => repos.listas.salvar({ ...l, estimativaCentavos: estimarCusto(await repos.itensLista.listarPorLista(l.id), compras).totalCentavos });
  const original = await estimar({ ...lista, mercadoId: habitualId });
  return { original, nova: await estimar(nova) };
}
