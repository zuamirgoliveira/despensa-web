"use client";

import Link from "next/link";
import { Card, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { TIPOS_IDA } from "@/schemas";
import { Backup } from "./Backup";
import { CasaLocalizacao } from "./CasaLocalizacao";
import { FormAgenda } from "./FormAgenda";
import { FormPerfil } from "./FormPerfil";

export function Ajustes() {
  const { mostrar } = useToast();
  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const casa = await r.iniciar();
    const [perfil, agendas, mercados] = await Promise.all([r.perfis.obterDaCasa(casa.id), r.agendas.listar(), r.mercados.listar()]);
    return { casa, perfil, agendas, mercados };
  }, ["perfis", "agendas", "mercados", "casas"]);

  if (carregando || !dados) return <p aria-live="polite">Carregando...</p>;
  const { casa, perfil, agendas, mercados } = dados;
  const salvou = (): void => mostrar("Ajustes salvos.");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Agenda das idas</h2>
        <p className="text-sm text-texto/70">A lista de cada ida é calculada pelas datas abaixo.</p>
        {TIPOS_IDA.map((tipo) => (
          <FormAgenda
            key={`${tipo}-${agendas.find((a) => a.tipo === tipo)?.id ?? "nova"}`}
            tipo={tipo}
            casaId={casa.id}
            agenda={agendas.find((a) => a.tipo === tipo)}
            mercados={mercados}
            aoSalvar={salvou}
          />
        ))}
      </Card>
      <Card className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Mercados</h2>
        <p className="text-sm text-texto/70">Distância, meio de transporte e custo de ida de cada mercado.</p>
        <Link href="/mercados" className="inline-flex min-h-11 items-center font-medium text-verde underline">
          Ver mercados
        </Link>
      </Card>
      {perfil ? <CasaLocalizacao key={`${perfil.id}-${perfil.localizacaoCasa?.lat}-${perfil.localizacaoCasa?.lng}-${perfil.arredondarLocalizacao}`} perfil={perfil} aoSalvar={salvou} /> : null}
      {perfil ? <FormPerfil key={perfil.id} perfil={perfil} aoSalvar={salvou} /> : null}
      <Backup />
    </div>
  );
}
