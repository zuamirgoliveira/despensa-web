"use client";

import Link from "next/link";
import { Badge, Card, Details, EmptyState } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { historicoPorProduto, LIMITE_VARIACAO_PCT } from "@/domain/precos";
import { brl, dataBR } from "@/lib/format";

const SUFIXO = { KG: "kg", UNID: "un", L: "l", PCT: "pct" } as const;

export function ListaPrecos() {
  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const [compras, mercados, produtos] = await Promise.all([r.compras.listar(), r.mercados.listar(), r.produtos.listar()]);
    return {
      historicos: historicoPorProduto(compras),
      mercados: new Map(mercados.map((m) => [m.id, m])),
      produtos: new Map(produtos.map((p) => [p.id, p])),
    };
  }, ["compras", "mercados", "produtos"]);

  if (carregando) return <p aria-live="polite">Carregando...</p>;
  if (!dados?.historicos.length) {
    return (
      <EmptyState
        titulo="Nenhum preço ainda"
        acao={
          <Link href="/importar" className="inline-flex min-h-11 items-center font-medium text-verde underline">
            Importar uma nota
          </Link>
        }
      >
        Os preços aparecem aqui depois da primeira nota importada.
      </EmptyState>
    );
  }

  const nome = (id: string): string => dados.produtos.get(id)?.nome ?? "Produto";
  const lista = [...dados.historicos].sort((a, b) => nome(a.produtoId).localeCompare(nome(b.produtoId), "pt-BR"));

  return (
    <ul className="flex flex-col gap-3">
      {lista.map((h) => {
        const suf = SUFIXO[h.unidade];
        const v = h.variacaoPct;
        const mostraVariacao = v !== undefined && Math.abs(v) >= LIMITE_VARIACAO_PCT;
        return (
          <li key={`${h.produtoId}|${h.unidade}`}>
            <Card className="p-3">
              <Details
                titulo={
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>{nome(h.produtoId)}</span>
                    <span className="flex items-center gap-2 font-semibold">
                      {brl(h.ultimo.precoCentavos)}/{suf}
                      {mostraVariacao ? (
                        <Badge tom={v > 0 ? "erro" : "verde"} aria-label={`variação de ${v.toFixed(1)}%`}>
                          {v > 0 ? "▲" : "▼"} {Math.abs(v).toFixed(1).replace(".", ",")}%
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                }
              >
                <p className="mb-2 text-sm text-texto/70">
                  Menor {brl(h.menorCentavos)}/{suf} · maior {brl(h.maiorCentavos)}/{suf}
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {[...h.pontos].reverse().map((p) => (
                    <li key={`${p.emissao}|${p.mercadoId}`} className="flex justify-between gap-2 border-t border-borda pt-1">
                      <span>
                        {dataBR(p.emissao)} · {dados.mercados.get(p.mercadoId)?.apelido || dados.mercados.get(p.mercadoId)?.nome || "Mercado"}
                      </span>
                      <span>
                        {brl(p.precoCentavos)}/{suf}
                      </span>
                    </li>
                  ))}
                </ul>
              </Details>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
