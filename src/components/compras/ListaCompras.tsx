"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Details, Dialog, EmptyState, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { custoRealCompra } from "@/domain/ida";
import type { Compra } from "@/domain/types";
import { brl, dataBR, horaBR, numeroBR } from "@/lib/format";

export function ListaCompras() {
  const { mostrar } = useToast();
  const [apagar, setApagar] = useState<Compra | null>(null);
  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const [compras, mercados, produtos] = await Promise.all([r.compras.listarPorEmissao(), r.mercados.listar(), r.produtos.listar()]);
    return {
      compras,
      mercados: new Map(mercados.map((m) => [m.id, m])),
      produtos: new Map(produtos.map((p) => [p.id, p])),
    };
  }, ["compras", "mercados", "produtos"]);

  async function confirmarApagar(): Promise<void> {
    if (!apagar) return;
    try {
      await (await criarRepositorios()).compras.apagar(apagar.chave);
      mostrar("Compra apagada.");
    } catch {
      mostrar("Não consegui apagar a compra.", "erro");
    }
    setApagar(null);
  }

  if (carregando) return <p aria-live="polite">Carregando...</p>;
  if (!dados?.compras.length) {
    return (
      <EmptyState
        titulo="Nenhuma compra ainda"
        acao={
          <Link href="/importar" className="inline-flex min-h-11 items-center font-medium text-verde underline">
            Importar uma nota
          </Link>
        }
      >
        Importe a nota de uma compra para ver o histórico aqui.
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {dados.compras.map((c) => {
          const mercado = dados.mercados.get(c.mercadoId);
          return (
            <li key={c.chave}>
              <Card className="flex flex-col gap-2 p-3">
                <Details
                  titulo={
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>
                        <span className="block">{mercado?.apelido || mercado?.nome || "Mercado"}</span>
                        <span className="block text-sm font-normal text-texto/70">
                          {dataBR(c.emissao)} {horaBR(c.emissao)}
                        </span>
                      </span>
                      <span className="font-semibold">{brl(c.valorTotalCentavos)}</span>
                    </span>
                  }
                >
                  {c.custoIdaCentavos !== undefined ? (
                    <p className="mb-2 text-sm" aria-label={`Custo real da compra de ${dataBR(c.emissao)}`}>
                      Custo da ida {brl(c.custoIdaCentavos)} · custo real {brl(custoRealCompra(c.valorTotalCentavos, c.custoIdaCentavos))}
                    </p>
                  ) : null}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-texto/70">
                        <th className="py-1 pr-2 font-medium">Produto</th>
                        <th className="py-1 pr-2 text-right font-medium">Qtd.</th>
                        <th className="py-1 pr-2 text-right font-medium">Unit.</th>
                        <th className="py-1 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.itens.map((i) => (
                        <tr key={i.codigo} className="border-t border-borda">
                          <td className="py-1 pr-2">{(i.produtoId && dados.produtos.get(i.produtoId)?.nome) || i.descricao}</td>
                          <td className="py-1 pr-2 text-right">
                            {numeroBR(i.quantidade)} {i.unidade.toLowerCase()}
                          </td>
                          <td className="py-1 pr-2 text-right">{brl(i.valorUnitarioCentavos)}</td>
                          <td className="py-1 text-right">{brl(i.valorTotalCentavos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Details>
                <Button variante="secundario" className="self-end" onClick={() => setApagar(c)}>
                  Apagar compra
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
      <Dialog
        aberto={apagar !== null}
        titulo="Apagar esta compra?"
        rotuloConfirmar="Apagar"
        perigo
        aoConfirmar={() => void confirmarApagar()}
        aoCancelar={() => setApagar(null)}
      >
        {apagar ? (
          <p>
            Compra de {dataBR(apagar.emissao)} no valor de {brl(apagar.valorTotalCentavos)}. O histórico de preços dela também some.
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
