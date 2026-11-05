// Serviço da lista de compras: gera, regera preservando edições e altera itens.
import { gerarLista, mesclarRegeracao, estimarCusto, type ItemListaSugerido } from "@/domain/lista";
import { proximaIdaDoTipo } from "@/domain/agenda";
import type { ItemLista, Lista, TipoIda } from "@/domain/types";
import type { Repositorios } from "./repositorios";

export class SemAgendaError extends Error {
  constructor(tipo: TipoIda) {
    super(`O tipo de ida "${tipo}" não tem agenda. Configure em Ajustes.`);
    this.name = "SemAgendaError";
  }
}

/**
 * Gera a lista da próxima ida do tipo. Se já existe uma lista aberta para essa ida, regera
 * preservando as edições manuais (removidos continuam removidos, quantidades editadas permanecem).
 */
export async function garantirLista(repos: Repositorios, tipo: TipoIda, hoje: string, agora: Date = new Date()): Promise<Lista> {
  const casa = await repos.iniciar();
  const [produtos, estoques, compras, agendas, perfil, listas] = await Promise.all([
    repos.produtos.listar(),
    repos.estoques.listar(),
    repos.compras.listar(),
    repos.agendas.listar(),
    repos.perfis.obterDaCasa(casa.id),
    repos.listas.listar(),
  ]);
  const gerada = gerarLista({ tipo, hoje, produtos, estoques, compras, agendas, folgaDias: perfil?.folgaDias ?? 2 });
  if (!gerada) throw new SemAgendaError(tipo);

  // Pode haver duas listas abertas da mesma ida depois de dividir: a regeração é da original (a mais antiga).
  const abertas = listas.filter((l) => l.tipoIda === tipo && l.data === gerada.ida.data && l.status !== "fechada").sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
  const existente = abertas[0];
  const irmaos = new Set<string>();
  for (const l of abertas.slice(1)) for (const i of await repos.itensLista.listarPorLista(l.id)) if (i.produtoId && !i.removido) irmaos.add(i.produtoId);
  gerada.itens = gerada.itens.filter((i) => !irmaos.has(i.produtoId)); // já estão na lista do outro mercado
  const lista =
    existente ??
    (await repos.listas.salvar({
      id: crypto.randomUUID(), casaId: casa.id, tipoIda: tipo, data: gerada.ida.data, status: "rascunho", criadaEm: agora.toISOString(),
    }));

  const pendentes = (await pendenciasDaListaAnterior(repos, tipo, gerada.ida.data, listas, new Set(gerada.itens.map((i) => i.produtoId)))).filter((i) => !irmaos.has(i.produtoId));
  const atuais = await repos.itensLista.listarPorLista(lista.id);
  const m = mesclarRegeracao([...gerada.itens, ...pendentes], atuais);
  for (const s of m.adicionar) {
    await repos.itensLista.salvar({
      id: crypto.randomUUID(), casaId: casa.id, listaId: lista.id, produtoId: s.produtoId, quantidadeSugerida: s.quantidade,
      status: "pendente", motivo: s.motivo, urgente: s.urgente, removido: false, quantidadeEditada: false,
    });
  }
  const porId = new Map(atuais.map((i) => [i.id, i]));
  for (const u of m.atualizar) {
    const i = porId.get(u.id) as ItemLista;
    await repos.itensLista.salvar({ ...i, quantidadeSugerida: u.quantidadeSugerida, motivo: u.motivo, urgente: u.urgente });
  }
  for (const id of m.remover) await repos.itensLista.apagar(id);

  const itens = await repos.itensLista.listarPorLista(lista.id);
  return repos.listas.salvar({ ...lista, estimativaCentavos: estimarCusto(itens, compras).totalCentavos });
}

/** A ida mais próxima na agenda (para o tipo padrão da tela). */
export async function tipoMaisProximo(repos: Repositorios, hoje: string): Promise<TipoIda | undefined> {
  const agendas = await repos.agendas.listar();
  const tipos: TipoIda[] = ["mercado_semanal", "hortifruti_semanal", "feira_mensal"];
  const idas = tipos.flatMap((t) => {
    const i = proximaIdaDoTipo(agendas, t, hoje);
    return i ? [i] : [];
  });
  return idas.sort((a, b) => a.data.localeCompare(b.data))[0]?.tipo;
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
 * Itens que ficaram de fora da última lista fechada do mesmo tipo (não pegos, não removidos) voltam como
 * sugestão, mesmo que a regra de cobertura não os incluísse (RN-11: "permanece pendente para a próxima ida").
 */
async function pendenciasDaListaAnterior(
  repos: Repositorios,
  tipo: TipoIda,
  dataDaIda: string,
  listas: readonly Lista[],
  jaSugeridos: ReadonlySet<string>,
): Promise<ItemListaSugerido[]> {
  const anterior = listas
    .filter((l) => l.status === "fechada" && l.tipoIda === tipo && l.data < dataDaIda)
    .sort((a, b) => b.data.localeCompare(a.data))[0];
  if (!anterior) return [];
  const produtos = new Map((await repos.produtos.listar()).map((p) => [p.id, p]));
  const saida: ItemListaSugerido[] = [];
  for (const i of await repos.itensLista.listarPorLista(anterior.id)) {
    const pendente = i.status === "pendente" || i.status === "nao_encontrado" || i.status === "adiado";
    if (!i.produtoId || i.removido || !pendente || jaSugeridos.has(i.produtoId) || !produtos.get(i.produtoId)?.ativo) continue;
    saida.push({ produtoId: i.produtoId, quantidade: i.quantidadeSugerida, motivo: "cobertura", urgente: false });
  }
  return saida;
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
  const nova = await repos.listas.salvar({
    id: crypto.randomUUID(), casaId: lista.casaId, tipoIda: lista.tipoIda, data: lista.data, status: "rascunho", mercadoId: alternativoId, criadaEm: agora.toISOString(),
  });
  for (const i of await repos.itensLista.listarPorLista(lista.id)) {
    if (!i.removido && i.produtoId && mover.has(i.produtoId)) await repos.itensLista.salvar({ ...i, listaId: nova.id });
  }
  const compras = await repos.compras.listar();
  const estimar = async (l: Lista): Promise<Lista> => repos.listas.salvar({ ...l, estimativaCentavos: estimarCusto(await repos.itensLista.listarPorLista(l.id), compras).totalCentavos });
  const original = await estimar({ ...lista, mercadoId: habitualId });
  return { original, nova: await estimar(nova) };
}
