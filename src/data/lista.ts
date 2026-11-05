// Serviço da lista de compras: gera, regera preservando edições e altera itens.
import { gerarLista, mesclarRegeracao, estimarCusto } from "@/domain/lista";
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

  const existente = listas.find((l) => l.tipoIda === tipo && l.data === gerada.ida.data && l.status !== "fechada");
  const lista =
    existente ??
    (await repos.listas.salvar({
      id: crypto.randomUUID(), casaId: casa.id, tipoIda: tipo, data: gerada.ida.data, status: "rascunho", criadaEm: agora.toISOString(),
    }));

  const atuais = await repos.itensLista.listarPorLista(lista.id);
  const m = mesclarRegeracao(gerada.itens, atuais);
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
