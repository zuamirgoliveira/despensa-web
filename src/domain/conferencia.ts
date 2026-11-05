// Conferência rápida da despensa: quais produtos perguntar antes de uma ida (RF-404).
import { diasEntre, soData } from "@/lib/datas";
import { idaSeguinte, proximaIdaDoTipo } from "./agenda";
import { LIMITE_PROVAVELMENTE_ACABANDO_DIAS, quantidadeReferencia } from "./estoque";
import { gerarLista, situacaoDoProduto, type EntradaLista } from "./lista";
import type { Nivel, Produto } from "./types";

export type MotivoConferencia = "na_lista" | "provavelmente_acabando" | "desatualizado" | "sem_registro";

export type ProdutoParaConferir = {
  produto: Produto;
  motivo: MotivoConferencia;
  nivelAtual?: Nivel;
  /** Nível que o app estima para hoje (base do atalho "Mesmo que o estimado"). */
  nivelEstimado?: Nivel;
  local: string;
};

export const SEM_LOCAL = "Sem local";

/** Nível mais próximo da fração estimada do estoque: ≥ 75% cheio, ≥ 35% metade, > 5% acabando, senão acabou. */
export function nivelEstimado(estoqueHoje: number, quantidadeRef: number): Nivel | undefined {
  if (quantidadeRef <= 0) return undefined;
  const f = estoqueHoje / quantidadeRef;
  if (f >= 0.75) return "cheio";
  if (f >= 0.35) return "metade";
  if (f > 0.05) return "acabando";
  return "acabou";
}

/**
 * Produtos que vencem na próxima ida do tipo: os que a lista incluiria, os que provavelmente já estão
 * acabando e os de nível desatualizado (sem confirmação há mais dias que o ciclo da ida) ou sem registro.
 * `undefined` quando o tipo não tem agenda.
 */
export function selecionarParaConferir(e: EntradaLista): ProdutoParaConferir[] | undefined {
  const ida = proximaIdaDoTipo(e.agendas, e.tipo, e.hoje);
  if (!ida) return undefined;
  const seguinte = idaSeguinte(e.agendas, e.tipo, ida.data);
  const ciclo = seguinte ? diasEntre(ida.data, seguinte.data) : 7;
  const naLista = new Set(gerarLista(e)?.itens.map((i) => i.produtoId));
  const saida: ProdutoParaConferir[] = [];

  for (const p of e.produtos) {
    if (!p.ativo) continue;
    const s = situacaoDoProduto(p, e);
    const registro = e.estoques.find((x) => x.produtoId === p.id);
    const estimado = nivelEstimado(s.estoqueHoje, quantidadeReferencia(p, e.compras));
    let motivo: MotivoConferencia | undefined;
    if (naLista.has(p.id)) motivo = "na_lista";
    else if (s.tipoProprio === e.tipo) {
      const acabando = s.nivel !== "acabando" && s.nivel !== "acabou" && s.coberturaHoje < LIMITE_PROVAVELMENTE_ACABANDO_DIAS;
      if (!registro) motivo = "sem_registro";
      else if (acabando) motivo = "provavelmente_acabando";
      else if (diasEntre(soData(registro.confirmadoEm), e.hoje) > ciclo) motivo = "desatualizado";
    }
    if (motivo) {
      saida.push({ produto: p, motivo, nivelAtual: registro?.nivel, nivelEstimado: estimado, local: p.localCasa?.trim() || SEM_LOCAL });
    }
  }
  return saida;
}

export type GrupoLocal = { local: string; itens: ProdutoParaConferir[] };

/** Agrupa por local da casa (geladeira, armário…), "Sem local" por último; nomes em ordem alfabética. */
export function agruparPorLocal(itens: readonly ProdutoParaConferir[]): GrupoLocal[] {
  const mapa = new Map<string, ProdutoParaConferir[]>();
  for (const i of itens) mapa.set(i.local, [...(mapa.get(i.local) ?? []), i]);
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === SEM_LOCAL ? 1 : b === SEM_LOCAL ? -1 : a.localeCompare(b, "pt-BR")))
    .map(([local, lista]) => ({ local, itens: [...lista].sort((a, b) => a.produto.nome.localeCompare(b.produto.nome, "pt-BR")) }));
}
