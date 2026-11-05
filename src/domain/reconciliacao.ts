// Reconciliação da nota com a lista (AGENTS.md 6.4): comprado, faltou e fora da lista.
import { chaveDeNome } from "./catalogo";
import type { Compra, ItemCompra, ItemLista, Lista } from "./types";

export type ItemComprado = { item: ItemLista; itensNota: ItemCompra[] };

export type Reconciliacao = {
  /** Estavam na lista e vieram na nota. */
  comprados: ItemComprado[];
  /** Estavam na lista e não vieram na nota: continuam pendentes para a próxima ida. */
  ficouDeFora: ItemLista[];
  /** Vieram na nota e não estavam na lista. */
  foraDaLista: ItemCompra[];
  /** Fora da lista em ida de reposição (mercado semanal ou hortifruti semanal). */
  emergencias: ItemCompra[];
};

const REPOSICAO: ReadonlySet<Lista["tipoIda"]> = new Set(["mercado_semanal", "hortifruti_semanal"]);

/** Ida de reposição: item fora da lista nela conta como compra de emergência. */
export function ehIdaDeReposicao(tipo: Lista["tipoIda"]): boolean {
  return REPOSICAO.has(tipo);
}

/**
 * Casa itens da nota com itens da lista pelo `produtoId` (já resolvido pelo apelido do mercado).
 * Itens avulsos e extras (sem produto) casam pelo nome contido na descrição da nota. Itens removidos
 * da lista são ignorados.
 */
export function reconciliar(lista: Pick<Lista, "tipoIda">, itensLista: readonly ItemLista[], itensNota: readonly ItemCompra[]): Reconciliacao {
  const ativos = itensLista.filter((i) => !i.removido);
  const usados = new Set<number>();
  const comprados: ItemComprado[] = [];
  const ficouDeFora: ItemLista[] = [];

  for (const item of ativos) {
    const achados = itensNota
      .map((n, idx) => ({ n, idx }))
      .filter(({ n, idx }) => {
        if (item.produtoId) return n.produtoId === item.produtoId;
        const nome = chaveDeNome(item.nomeAvulso ?? "");
        return nome.length > 0 && !usados.has(idx) && chaveDeNome(n.descricao).includes(nome);
      });
    if (achados.length) {
      achados.forEach(({ idx }) => usados.add(idx));
      comprados.push({ item, itensNota: achados.map(({ n }) => n) });
    } else ficouDeFora.push(item);
  }

  const foraDaLista = itensNota.filter((n, idx) => !usados.has(idx) && !ativos.some((i) => i.produtoId && i.produtoId === n.produtoId));
  return { comprados, ficouDeFora, foraDaLista, emergencias: ehIdaDeReposicao(lista.tipoIda) ? foraDaLista : [] };
}

export type ResumoDaCompra = {
  comprados: number;
  faltou: number;
  foraDaLista: number;
  emergencias: number;
  gastoCentavos: number;
  estimativaCentavos?: number;
  /** Gasto menos estimativa (positivo = gastou mais). */
  diferencaCentavos?: number;
  custoIdaCentavos?: number;
  /** Itens + ida (RN-10), quando há custo da ida. */
  custoRealCentavos?: number;
};

export function resumirCompra(r: Reconciliacao, compra: Pick<Compra, "valorTotalCentavos" | "custoIdaCentavos">, estimativaCentavos?: number): ResumoDaCompra {
  const gasto = compra.valorTotalCentavos;
  return {
    comprados: r.comprados.length,
    faltou: r.ficouDeFora.length,
    foraDaLista: r.foraDaLista.length,
    emergencias: r.emergencias.length,
    gastoCentavos: gasto,
    estimativaCentavos,
    diferencaCentavos: estimativaCentavos === undefined ? undefined : gasto - estimativaCentavos,
    custoIdaCentavos: compra.custoIdaCentavos,
    custoRealCentavos: compra.custoIdaCentavos === undefined ? undefined : gasto + compra.custoIdaCentavos,
  };
}
