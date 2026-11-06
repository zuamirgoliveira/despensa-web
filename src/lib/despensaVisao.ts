// Visão da tela Despensa: junta produto + estoque, filtra, ordena e agrupa. Puro (sem React nem IndexedDB).
import { chaveDeNome } from "@/domain/catalogo";
import { quantidadePadrao, quantidadeQueFalta, situacaoDoItem, type SituacaoItem } from "@/domain/despensa";
import { sugerirDeixarDeRepor, sugerirReporSempre, type SugestaoRecorrencia } from "@/domain/recorrencia";
import type { Compra, Estoque, Produto } from "@/domain/types";
import { CATEGORIAS } from "@/schemas";
import { CATEGORIA_ROTULO } from "./rotulos";

export type LinhaDespensa = {
  produto: Produto;
  atual: number | undefined;
  padrao: number | undefined;
  situacao: SituacaoItem;
  falta: number | undefined;
  sugestao: SugestaoRecorrencia | undefined;
};

export type FiltroDespensa = "todos" | "faltando" | "zerados" | "nao_recorrentes" | "sem_padrao";
export type AgruparPor = "categoria" | "local";

export function montarLinhas(
  produtos: readonly Produto[],
  estoques: readonly Estoque[],
  compras: readonly Compra[],
  hoje: string,
): LinhaDespensa[] {
  const porProduto = new Map(estoques.map((e) => [e.produtoId, e]));
  return produtos.map((produto) => {
    const estoque = porProduto.get(produto.id);
    return {
      produto,
      atual: estoque?.quantidade,
      padrao: quantidadePadrao(produto),
      situacao: situacaoDoItem(produto, estoque),
      falta: quantidadeQueFalta(produto, estoque),
      sugestao: sugerirReporSempre(produto, compras) ?? sugerirDeixarDeRepor(produto, compras, hoje),
    };
  });
}

const PASSA: Record<FiltroDespensa, (l: LinhaDespensa) => boolean> = {
  todos: () => true,
  faltando: (l) => l.produto.recorrente && (l.situacao === "zerado" || l.situacao === "abaixo"),
  zerados: (l) => l.situacao === "zerado",
  nao_recorrentes: (l) => !l.produto.recorrente,
  sem_padrao: (l) => l.padrao === undefined,
};

export function filtrarLinhas(linhas: readonly LinhaDespensa[], filtro: FiltroDespensa, busca: string, arquivados: boolean): LinhaDespensa[] {
  const termo = chaveDeNome(busca);
  return linhas.filter((l) => (arquivados || l.produto.ativo) && PASSA[filtro](l) && chaveDeNome(l.produto.nome).includes(termo));
}

export type GrupoDespensa = { chave: string; titulo: string; linhas: LinhaDespensa[] };

const porNome = (a: LinhaDespensa, b: LinhaDespensa) => a.produto.nome.localeCompare(b.produto.nome, "pt-BR");

/** Agrupa por categoria (ordem fixa) ou por local da casa (alfabético; "Sem local" por último). */
export function agruparLinhas(linhas: readonly LinhaDespensa[], por: AgruparPor): GrupoDespensa[] {
  if (por === "categoria") {
    return CATEGORIAS.map((c) => ({ chave: c, titulo: CATEGORIA_ROTULO[c], linhas: linhas.filter((l) => l.produto.categoria === c).sort(porNome) })).filter((g) => g.linhas.length);
  }
  const locais = new Map<string, LinhaDespensa[]>();
  for (const l of linhas) {
    const local = l.produto.localCasa?.trim() || "";
    locais.set(local, [...(locais.get(local) ?? []), l]);
  }
  return [...locais]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "pt-BR")))
    .map(([local, ls]) => ({ chave: local || "sem-local", titulo: local || "Sem local", linhas: ls.sort(porNome) }));
}

export type ResumoDespensa = { itens: number; zerados: number; abaixo: number; naoRecorrentesZerados: number };

/** Números do topo da tela (só itens ativos). `abaixo` e `zerados` contam recorrentes, que são os que vão para a lista. */
export function resumirDespensa(linhas: readonly LinhaDespensa[]): ResumoDespensa {
  const ativas = linhas.filter((l) => l.produto.ativo);
  const rec = ativas.filter((l) => l.produto.recorrente);
  return {
    itens: ativas.length,
    zerados: rec.filter((l) => l.situacao === "zerado").length,
    abaixo: rec.filter((l) => l.situacao === "abaixo").length,
    naoRecorrentesZerados: ativas.filter((l) => !l.produto.recorrente && l.situacao === "zerado").length,
  };
}

/** Lê uma quantidade digitada ("1,5" ou "1.5"). `undefined` se vazia, negativa ou inválida. */
export function lerQuantidade(texto: string): number | undefined {
  const t = texto.trim().replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : undefined;
}
