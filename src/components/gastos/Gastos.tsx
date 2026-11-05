"use client";

import Link from "next/link";
import { Card, Details, EmptyState } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { gastosPorMes, serieDeInflacao } from "@/domain/gastos";
import type { Categoria } from "@/domain/types";
import { brl } from "@/lib/format";
import { CATEGORIA_ROTULO } from "@/lib/rotulos";
import { GraficoSerie } from "./GraficoSerie";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string): string => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const pct = (v: number): string => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;

export function Gastos() {
  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const [compras, produtos] = await Promise.all([r.compras.listar(), r.produtos.listar()]);
    return { meses: gastosPorMes(compras, produtos), inflacao: serieDeInflacao(compras) };
  }, ["compras", "produtos"]);

  if (carregando || !dados) return <p aria-live="polite">Carregando...</p>;
  if (!dados.meses.length) {
    return (
      <EmptyState titulo="Nenhum gasto ainda" acao={<Link href="/importar" className="inline-flex min-h-11 items-center font-medium text-verde underline">Importar uma nota</Link>}>
        Os gastos aparecem depois da primeira nota importada.
      </EmptyState>
    );
  }
  const cronologico = [...dados.meses].reverse();
  const comInflacao = dados.inflacao.filter((i) => i.variacaoPct !== undefined);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Custo real por mês</h2>
        <p className="text-sm text-texto/70">Itens + custo das idas.</p>
        <GraficoSerie
          valores={cronologico.map((m) => m.custoRealCentavos)}
          rotulos={cronologico.map((m) => rotuloMes(m.mes))}
          formatar={brl}
          descricao="Custo real por mês"
        />
      </Card>

      <Card className="flex flex-col gap-2" aria-label="Inflação pessoal">
        <h2 className="text-lg font-semibold">Inflação pessoal</h2>
        <p className="text-sm text-texto/70">
          Variação do custo de uma cesta fixa: só os produtos que você comprou nos dois meses, a preço normalizado. Comprar mais ou menos não muda o índice.
        </p>
        {comInflacao.length === 0 ? (
          <p className="text-sm">Precisa de compras do mesmo produto em dois meses seguidos.</p>
        ) : (
          <>
            <GraficoSerie
              valores={comInflacao.map((i) => i.variacaoPct as number)}
              rotulos={comInflacao.map((i) => rotuloMes(i.para))}
              formatar={pct}
              descricao="Inflação pessoal mês a mês"
            />
            <ul className="text-sm">
              {comInflacao.map((i) => (
                <li key={i.para} className="flex justify-between">
                  <span>
                    {rotuloMes(i.de)} → {rotuloMes(i.para)} ({i.itens} {i.itens === 1 ? "produto" : "produtos"})
                  </span>
                  <span className="font-semibold">{pct(i.variacaoPct as number)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <h2 className="text-lg font-semibold">Mês a mês</h2>
      <ul className="flex flex-col gap-3">
        {dados.meses.map((m) => {
          const maior = Math.max(...Object.values(m.porCategoria).map((v) => v ?? 0), 1);
          return (
            <li key={m.mes}>
              <Card className="p-3">
                <Details
                  aberto={m === dados.meses[0]}
                  titulo={
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>{rotuloMes(m.mes)}</span>
                      <span aria-label={`Custo real de ${rotuloMes(m.mes)}`}>{brl(m.custoRealCentavos)}</span>
                    </span>
                  }
                >
                  <p className="mb-2 text-sm">
                    Itens {brl(m.itensCentavos)} · deslocamento {brl(m.deslocamentoCentavos)} · {m.compras} {m.compras === 1 ? "compra" : "compras"}
                  </p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {(Object.entries(m.porCategoria) as [Categoria, number][])
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, v]) => (
                        <li key={cat}>
                          <div className="flex justify-between">
                            <span>{CATEGORIA_ROTULO[cat]}</span>
                            <span>{brl(v)}</span>
                          </div>
                          <div className="h-2 rounded bg-borda" aria-hidden>
                            <div className="h-2 rounded bg-verde" style={{ width: `${(v / maior) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                  </ul>
                </Details>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
