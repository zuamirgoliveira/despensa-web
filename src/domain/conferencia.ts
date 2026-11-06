// Revisão da despensa: quais itens perguntar para atualizar a quantidade (antes: conferência por ida, RF-404).
import { diasEntre, soData } from "@/lib/datas";
import { coberturaDias, consumoDiario, estoqueAgora, LIMITE_PROVAVELMENTE_ACABANDO_DIAS, quantidadeReferencia } from "./estoque";
import type { Compra, Estoque, Nivel, Produto } from "./types";

export type MotivoConferencia = "provavelmente_acabando" | "desatualizado" | "sem_registro";

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

/** Dias sem confirmar a quantidade a partir dos quais um item entra na revisão. */
export const DIAS_PARA_REVISAR = 14;

/**
 * Revisão da despensa (opcional, sem ida): itens ativos **sem quantidade registrada**, que **provavelmente já estão
 * acabando** (cobertura estimada de hoje < 2 dias) ou **desatualizados** (sem confirmação há mais de `DIAS_PARA_REVISAR`).
 */
export function selecionarParaRevisar(e: {
  hoje: string;
  produtos: readonly Produto[];
  estoques: readonly Estoque[];
  compras: readonly Compra[];
}): ProdutoParaConferir[] {
  const saida: ProdutoParaConferir[] = [];
  for (const p of e.produtos) {
    if (!p.ativo) continue;
    const registro = e.estoques.find((x) => x.produtoId === p.id);
    let motivo: MotivoConferencia | undefined;
    let estimado: Nivel | undefined;
    if (!registro) motivo = "sem_registro";
    else {
      const ref = quantidadeReferencia(p, e.compras);
      const consumo = consumoDiario(p, e.compras);
      const agora = estoqueAgora(registro.nivel, ref, consumo, registro.confirmadoEm, e.hoje);
      estimado = nivelEstimado(agora, ref);
      if (registro.nivel !== "acabando" && registro.nivel !== "acabou" && coberturaDias(agora, consumo) < LIMITE_PROVAVELMENTE_ACABANDO_DIAS) motivo = "provavelmente_acabando";
      else if (diasEntre(soData(registro.confirmadoEm), e.hoje) > DIAS_PARA_REVISAR) motivo = "desatualizado";
    }
    if (motivo) saida.push({ produto: p, motivo, nivelAtual: registro?.nivel, nivelEstimado: estimado, local: p.localCasa?.trim() || SEM_LOCAL });
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
