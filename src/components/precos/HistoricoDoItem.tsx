import { historicoDoProduto, LIMITE_VARIACAO_PCT } from "@/domain/precos";
import type { Compra, Mercado } from "@/domain/types";
import { brl, dataBR } from "@/lib/format";
import { GraficoPreco } from "./GraficoPreco";

const SUFIXO = { kg: "kg", un: "un", l: "l", "100g": "100 g", "100ml": "100 ml" } as const;

/** Histórico de preço de um item da despensa (gráfico e compras), reaproveitando o domínio da tela Preços. */
export function HistoricoDoItem({ produtoId, compras, mercados }: { produtoId: string; compras: readonly Compra[]; mercados: readonly Mercado[] }) {
  const historicos = historicoDoProduto(compras, produtoId);
  if (!historicos.length) return <p className="text-sm text-suave">Ainda sem preço: ele aparece depois de uma nota com este item.</p>;
  const nomeDoMercado = (id: string) => {
    const m = mercados.find((x) => x.id === id);
    return m?.apelido || m?.nome || "Mercado";
  };
  return (
    <div className="flex flex-col gap-3" data-testid="historico-item">
      {historicos.map((h) => {
        const suf = SUFIXO[h.base];
        const v = h.variacaoPct;
        return (
          <div key={h.base} className="flex flex-col gap-2">
            <p className="numero text-sm">
              Último: <strong>{brl(h.ultimo.normalizadoCentavos)}/{suf}</strong>
              {v !== undefined && Math.abs(v) >= LIMITE_VARIACAO_PCT ? ` (${v > 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1).replace(".", ",")}%)` : ""}
            </p>
            <p className="text-sm text-suave">
              Menor {brl(h.menorCentavos)}/{suf} · maior {brl(h.maiorCentavos)}/{suf} · média {brl(h.mediaCentavos)}/{suf}
            </p>
            <GraficoPreco valores={h.pontos.map((p) => p.normalizadoCentavos)} sufixo={`/${suf}`} />
            <ul className="flex flex-col gap-1 text-sm">
              {[...h.pontos].reverse().slice(0, 5).map((p) => (
                <li key={`${p.emissao}|${p.mercadoId}`} className="flex justify-between gap-2 border-t border-borda pt-1">
                  <span>
                    {dataBR(p.emissao)} · {nomeDoMercado(p.mercadoId)}
                  </span>
                  <span className="numero">
                    {brl(p.normalizadoCentavos)}/{suf}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
