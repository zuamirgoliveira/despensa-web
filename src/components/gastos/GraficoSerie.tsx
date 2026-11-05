import { pontosDoGrafico } from "@/lib/grafico";

const L = 320;
const A = 100;

/** Linha simples em SVG (sem biblioteca) para uma série de valores com rótulos nos extremos. */
export function GraficoSerie({ valores, rotulos, formatar, descricao }: { valores: readonly number[]; rotulos: readonly string[]; formatar: (v: number) => string; descricao: string }) {
  if (valores.length < 2) return null;
  const pts = pontosDoGrafico(valores, L, A, 22);
  return (
    <svg role="img" aria-label={`${descricao}: ${valores.map((v, i) => `${rotulos[i]} ${formatar(v)}`).join("; ")}`} viewBox={`0 0 ${L} ${A + 20}`} className="h-32 w-full">
      <line x1="12" x2={L - 12} y1={A / 2} y2={A / 2} className="stroke-borda-forte" strokeWidth="1" strokeDasharray="4 4" />
      <polyline fill="none" className="stroke-primario" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" className="fill-primario stroke-superficie" strokeWidth="1.5" />
          <text x={p.x} y={A + 16} fontSize="11" textAnchor="middle" className="fill-suave">
            {rotulos[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}
