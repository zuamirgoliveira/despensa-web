import { brl } from "@/lib/format";
import { pontosDoGrafico } from "@/lib/grafico";

const L = 320;
const A = 90;

/** Gráfico de linha em SVG próprio (sem biblioteca). */
export function GraficoPreco({ valores, sufixo }: { valores: readonly number[]; sufixo: string }) {
  if (valores.length < 2) return null;
  const pts = pontosDoGrafico(valores, L, A);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return (
    <svg
      role="img"
      aria-label={`Gráfico de preço: de ${brl(valores[0])}${sufixo} a ${brl(valores[valores.length - 1])}${sufixo}; mínimo ${brl(min)}, máximo ${brl(max)}`}
      viewBox={`0 0 ${L} ${A}`}
      className="h-24 w-full"
    >
      <polyline fill="none" className="stroke-primario" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" className="fill-primario stroke-superficie" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
