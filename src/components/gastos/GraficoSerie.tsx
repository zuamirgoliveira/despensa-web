import { pontosDoGrafico } from "@/lib/grafico";

const L = 320;
const A = 100;

/** Linha simples em SVG (sem biblioteca) para uma série de valores com rótulos nos extremos. */
export function GraficoSerie({ valores, rotulos, formatar, descricao }: { valores: readonly number[]; rotulos: readonly string[]; formatar: (v: number) => string; descricao: string }) {
  if (valores.length < 2) return null;
  const pts = pontosDoGrafico(valores, L, A, 12);
  return (
    <svg role="img" aria-label={`${descricao}: ${valores.map((v, i) => `${rotulos[i]} ${formatar(v)}`).join("; ")}`} viewBox={`0 0 ${L} ${A + 16}`} className="h-28 w-full">
      <line x1="12" x2={L - 12} y1={A / 2} y2={A / 2} stroke="#d6ddd9" strokeDasharray="4 4" />
      <polyline fill="none" stroke="#1f6f4a" strokeWidth="2" points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#1f6f4a" />
          <text x={p.x} y={A + 12} fontSize="9" textAnchor="middle" fill="#1d2420">
            {rotulos[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}
