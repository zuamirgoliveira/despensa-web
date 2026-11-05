"use client";

import Link from "next/link";
import { Badge, Button, Card, Details, EmptyState, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { custoDaCesta, melhorMercadoPorProduto, sugerirMercadoPreferido } from "@/domain/comparacao";
import { hojeRecife } from "@/lib/datas";
import { brl } from "@/lib/format";

const SUFIXO = { kg: "/kg", un: "/un", l: "/l", "100g": "/100 g", "100ml": "/100 ml" } as const;

export function ComparacaoMercados() {
  const { mostrar } = useToast();
  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const casa = await r.iniciar();
    const [compras, mercados, produtos, perfil] = await Promise.all([r.compras.listar(), r.mercados.listar(), r.produtos.listar(), r.perfis.obterDaCasa(casa.id)]);
    const janela = perfil?.janelaPrecoDias ?? 60;
    return { comparacoes: melhorMercadoPorProduto(compras, hojeRecife(), janela), mercados, produtos, janela };
  }, ["compras", "mercados", "produtos", "perfis"]);

  if (carregando || !dados) return <p aria-live="polite">Carregando...</p>;
  const nomeMercado = (id: string): string => {
    const m = dados.mercados.find((x) => x.id === id);
    return m?.apelido || m?.nome || "Mercado";
  };
  const produtoPorId = new Map(dados.produtos.map((p) => [p.id, p]));
  const comMaisDeUm = [...dados.comparacoes.values()].filter((c) => c.mercados.length >= 2);
  const mercadosComPreco = dados.mercados.filter((m) => [...dados.comparacoes.values()].some((c) => c.mercados.some((x) => x.mercadoId === m.id)));

  if (mercadosComPreco.length < 2) {
    return (
      <EmptyState
        titulo="Falta um segundo mercado"
        acao={
          <Link href="/importar" className="inline-flex min-h-11 items-center font-medium text-verde underline">
            Importar uma nota
          </Link>
        }
      >
        A comparação aparece quando há preços de pelo menos dois mercados nos últimos {dados.janela} dias.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2" aria-label="Cesta por mercado">
        <h2 className="text-lg font-semibold">Cesta por mercado</h2>
        <p className="text-sm text-texto/70">Meta de cada produto × último preço. Compare só cestas com a mesma cobertura.</p>
        <ul className="flex flex-col gap-1">
          {mercadosComPreco.map((m) => {
            const c = custoDaCesta(dados.produtos, m.id, dados.comparacoes);
            return (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>{m.apelido || m.nome}</span>
                <span className="text-right">
                  <span className="font-semibold">{brl(c.totalCentavos)}</span>
                  <span className="block text-xs text-texto/70">
                    preços de {c.cobertos} de {c.totalItens} itens
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <h2 className="text-lg font-semibold">Por produto</h2>
      {comMaisDeUm.length === 0 ? <p className="text-sm text-texto/70">Nenhum produto tem preço em dois mercados ainda.</p> : null}
      <ul className="flex flex-col gap-3">
        {comMaisDeUm
          .sort((a, b) => (produtoPorId.get(a.produtoId)?.nome ?? "").localeCompare(produtoPorId.get(b.produtoId)?.nome ?? "", "pt-BR"))
          .map((c) => {
            const produto = produtoPorId.get(c.produtoId);
            const sugestao = produto ? sugerirMercadoPreferido(produto, dados.comparacoes) : undefined;
            return (
              <li key={c.produtoId}>
                <Card className="p-3">
                  <Details titulo={<span className="flex w-full justify-between gap-2"><span>{produto?.nome ?? "Produto"}</span><span className="text-sm font-normal text-texto/70">{c.mercados.length} mercados</span></span>}>
                    <ul className="flex flex-col gap-1 text-sm">
                      {c.mercados.map((m) => (
                        <li key={m.mercadoId} className="flex items-center justify-between gap-2">
                          <span>
                            {nomeMercado(m.mercadoId)} {m.mercadoId === c.melhorMercadoId ? <Badge tom="verde">{c.empate ? "empate" : "melhor"}</Badge> : null}
                          </span>
                          <span>
                            {brl(m.normalizadoCentavos)}
                            {SUFIXO[c.base]}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {sugestao && produto ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <p className="text-sm">
                          Sugestão: {nomeMercado(sugestao.mercadoId)} é {Math.round(sugestao.economiaPct)}% mais barato.
                        </p>
                        <Button
                          variante="secundario"
                          onClick={async () => {
                            await (await criarRepositorios()).produtos.salvar({ ...produto, mercadoPreferidoId: sugestao.mercadoId });
                            mostrar(`Mercado preferido de ${produto.nome} definido.`);
                          }}
                        >
                          Definir {nomeMercado(sugestao.mercadoId)} como preferido
                        </Button>
                      </div>
                    ) : null}
                  </Details>
                </Card>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
