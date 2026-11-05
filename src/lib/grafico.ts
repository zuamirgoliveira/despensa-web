export type PontoXY = { x: number; y: number };

/**
 * Converte uma série de valores em pontos de um gráfico de linha SVG (y cresce para baixo).
 * Um ponto só fica no centro; série constante fica na linha do meio.
 */
export function pontosDoGrafico(valores: readonly number[], largura: number, altura: number, margem = 8): PontoXY[] {
  if (!valores.length) return [];
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const w = largura - 2 * margem;
  const h = altura - 2 * margem;
  return valores.map((v, i) => ({
    x: valores.length === 1 ? largura / 2 : margem + (i * w) / (valores.length - 1),
    y: max === min ? altura / 2 : margem + h - ((v - min) / (max - min)) * h,
  }));
}
