"use client";

import Link from "next/link";
import { Card, EmptyState, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { estatisticasDeIdas } from "@/domain/ida";
import { hojeRecife } from "@/lib/datas";
import { brl } from "@/lib/format";
import { FormMercado } from "./FormMercado";

export function Mercados() {
  const { mostrar } = useToast();
  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const casa = await r.iniciar();
    const [mercados, compras, perfil] = await Promise.all([r.mercados.listar(), r.compras.listar(), r.perfis.obterDaCasa(casa.id)]);
    return { mercados, compras, perfil };
  }, ["mercados", "compras", "perfis"]);

  if (carregando || !dados) return <p aria-live="polite">Carregando...</p>;
  if (!dados.perfil || dados.mercados.length === 0) {
    return (
      <EmptyState
        titulo="Nenhum mercado ainda"
        acao={
          <Link href="/importar" className="inline-flex min-h-11 items-center font-medium text-primario underline">
            Importar uma nota
          </Link>
        }
      >
        Os mercados são criados pelo CNPJ das notas que você importa.
      </EmptyState>
    );
  }

  const [ano, mes] = hojeRecife().split("-").map(Number);
  const e = estatisticasDeIdas(dados.compras, dados.mercados, ano, mes);
  const perfil = dados.perfil;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1" aria-label="Idas do mês">
        <h2 className="text-sm">Este mês</h2>
        <p>
          {e.idas} {e.idas === 1 ? "ida" : "idas"} ao mercado · {e.minutos} min de deslocamento (ida e volta)
        </p>
        <p className="text-sm text-suave">
          {e.custoTotalCentavos > 0 ? `Custo das idas: ${brl(e.custoTotalCentavos)}. ` : ""}
          Tempo e número de idas são só informação: não entram no custo.
          {e.semEstimativa > 0 ? ` ${e.semEstimativa} ${e.semEstimativa === 1 ? "ida está" : "idas estão"} sem tempo estimado.` : ""}
        </p>
      </Card>
      {dados.mercados.map((m) => (
        <FormMercado key={`${m.id}-${m.distanciaKm}-${m.transporte}-${m.tempoMinIda}-${m.custoFixoIdaCentavos}-${m.apelido}-${m.tipo}`} mercado={m} perfil={perfil} aoSalvar={() => mostrar("Mercado salvo.")} />
      ))}
    </div>
  );
}
