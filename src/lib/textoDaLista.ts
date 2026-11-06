// Texto da lista de compras para compartilhar (WhatsApp, e-mail...). Só o que ainda falta comprar, agrupado por seção.
import { brl, numeroBR } from "./format";
import type { GrupoLista } from "./agruparLista";

const UNIDADE_CURTA = { kg: "kg", un: "un", pacote: "pct", l: "L" } as const;

const faltaComprar = (status: string): boolean => status !== "pego" && status !== "extra";

/**
 * Monta o texto da lista: título com a data, seções e uma linha `• Nome: quantidade unidade (~valor)` por item; o valor só aparece com preço conhecido e há uma linha de estimativa no fim.
 * Ficam de fora os itens removidos (a tela já os separa), os já pegos e os extras. `undefined` se não sobra nada.
 */
export function textoDaLista(
  grupos: readonly GrupoLista[],
  dataTexto: string,
  precoUnitario?: (produtoId: string) => number | undefined,
): string | undefined {
  const blocos: string[] = [];
  let total = 0;
  let comEstimativa = false;
  for (const g of grupos) {
    const linhas = g.itens
      .filter((v) => !v.item.removido && faltaComprar(v.item.status))
      .map((v) => {
        const nome = v.produto?.nome ?? v.item.nomeAvulso ?? "";
        const unidade = v.produto ? ` ${UNIDADE_CURTA[v.produto.unidade]}` : "";
        const preco = v.item.produtoId ? precoUnitario?.(v.item.produtoId) : undefined;
        let estimativa = "";
        if (preco !== undefined) {
          const valor = Math.round(v.item.quantidadeSugerida * preco);
          total += valor;
          comEstimativa = true;
          estimativa = ` (~${brl(valor)})`;
        }
        return `• ${nome}: ${numeroBR(v.item.quantidadeSugerida)}${unidade}${estimativa}`;
      });
    if (linhas.length) blocos.push([g.titulo, ...linhas].join("\n"));
  }
  if (!blocos.length) return undefined;
  if (comEstimativa) blocos.push(`Estimativa: ~${brl(total)}`);
  return [`Lista de compras (${dataTexto})`, ...blocos].join("\n\n");
}
