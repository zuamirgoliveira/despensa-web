// Texto da lista de compras para compartilhar (WhatsApp, e-mail...). Só o que ainda falta comprar, agrupado por seção.
import { numeroBR } from "./format";
import type { GrupoLista } from "./agruparLista";

const UNIDADE_CURTA = { kg: "kg", un: "un", pacote: "pct", l: "L" } as const;

const faltaComprar = (status: string): boolean => status !== "pego" && status !== "extra";

/**
 * Monta o texto da lista: título com a data, seções e uma linha `• Nome: quantidade unidade` por item.
 * Ficam de fora os itens removidos (a tela já os separa), os já pegos e os extras. `undefined` se não sobra nada.
 */
export function textoDaLista(grupos: readonly GrupoLista[], dataTexto: string): string | undefined {
  const blocos: string[] = [];
  for (const g of grupos) {
    const linhas = g.itens
      .filter((v) => !v.item.removido && faltaComprar(v.item.status))
      .map((v) => {
        const nome = v.produto?.nome ?? v.item.nomeAvulso ?? "";
        const unidade = v.produto ? ` ${UNIDADE_CURTA[v.produto.unidade]}` : "";
        return `• ${nome}: ${numeroBR(v.item.quantidadeSugerida)}${unidade}`;
      });
    if (linhas.length) blocos.push([g.titulo, ...linhas].join("\n"));
  }
  return blocos.length ? [`Lista de compras (${dataTexto})`, ...blocos].join("\n\n") : undefined;
}
