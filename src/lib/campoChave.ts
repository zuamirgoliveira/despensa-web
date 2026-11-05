import { agruparChave } from "./format";

const soDigitos = (s: string): string => s.replace(/\D/g, "");

/** Posição no texto agrupado logo depois do k-ésimo dígito (0 = início). */
function posicaoApos(texto: string, k: number): number {
  if (k <= 0) return 0;
  let n = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/\d/.test(texto[i]) && ++n === k) return i + 1;
  }
  return texto.length;
}

export type EdicaoChave = { texto: string; cursor: number };

/**
 * Edição do campo da chave (grupos de 4 separados por espaço) sem perder o cursor.
 * Sem isso, reformatar a cada tecla joga o cursor para o fim e só dá para apagar da direita para a esquerda.
 *
 * - `novo` e `cursor`: valor do campo e posição do cursor logo depois da edição do navegador.
 * - `tipoEntrada`: `inputType` do evento (`deleteContentBackward`/`deleteContentForward` ...).
 * Apagar um espaço (que a formatação recoloca) apaga o dígito vizinho, para o cursor atravessar os grupos.
 */
export function editarChave(anterior: string, novo: string, cursor: number, tipoEntrada = ""): EdicaoChave {
  let digitos = soDigitos(novo);
  let k = soDigitos(novo.slice(0, cursor)).length;
  if (digitos === soDigitos(anterior)) {
    if (tipoEntrada === "deleteContentBackward" && k > 0) {
      digitos = digitos.slice(0, k - 1) + digitos.slice(k);
      k -= 1;
    } else if (tipoEntrada === "deleteContentForward") {
      digitos = digitos.slice(0, k) + digitos.slice(k + 1);
    }
  }
  digitos = digitos.slice(0, 44);
  k = Math.min(k, digitos.length);
  const texto = agruparChave(digitos);
  return { texto, cursor: posicaoApos(texto, k) };
}
