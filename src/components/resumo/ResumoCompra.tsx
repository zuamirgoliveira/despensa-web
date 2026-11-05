"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Card, Details, EmptyState, LinkBotao } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { resumoDaLista } from "@/data/reconciliacao";
import { useRepositorio } from "@/data/useRepositorio";
import { ehIdaDeReposicao } from "@/domain/reconciliacao";
import { brl, dataBR, numeroBR } from "@/lib/format";
import { TIPO_IDA_ROTULO } from "@/lib/rotulos";

export function ResumoCompra() {
  const [listaId, setListaId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    queueMicrotask(() => setListaId(new URLSearchParams(location.search).get("lista")));
  }, []);

  const { dados, carregando } = useRepositorio(async () => {
    if (!listaId) return undefined;
    const r = await criarRepositorios();
    const resumo = await resumoDaLista(r, listaId);
    const produtos = new Map((await r.produtos.listar()).map((p) => [p.id, p]));
    return resumo && { ...resumo, produtos };
  }, ["listas", "itensLista", "compras", "produtos"], [listaId]);

  if (listaId === undefined || carregando) return <p aria-live="polite">Carregando...</p>;
  if (!dados) {
    return (
      <EmptyState titulo="Resumo não encontrado" acao={<Link href="/compras" className="inline-flex min-h-11 items-center font-medium text-primario underline">Ver compras</Link>}>
        Este resumo existe depois que uma nota é associada a uma lista.
      </EmptyState>
    );
  }
  const { lista, compra, reconciliacao: r, resumo, produtos } = dados;
  const nome = (id?: string, fallback = ""): string => (id && produtos.get(id)?.nome) || fallback;
  const reposicao = ehIdaDeReposicao(lista.tipoIda);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1">
        <p className="text-sm text-suave">
          {TIPO_IDA_ROTULO[lista.tipoIda]} · lista de {dataBR(lista.data)} · nota de {dataBR(compra.emissao)}
        </p>
        <p className="text-2xl font-semibold" aria-label="Total gasto">
          {brl(resumo.gastoCentavos)}
        </p>
        {resumo.estimativaCentavos !== undefined && resumo.diferencaCentavos !== undefined ? (
          <p className="text-sm">
            Estimado {brl(resumo.estimativaCentavos)} ·{" "}
            {resumo.diferencaCentavos === 0
              ? "igual à estimativa"
              : `${brl(Math.abs(resumo.diferencaCentavos))} ${resumo.diferencaCentavos > 0 ? "acima" : "abaixo"} da estimativa`}
          </p>
        ) : null}
        <p className="text-sm" aria-label="Custo da ida">
          {resumo.custoIdaCentavos === undefined
            ? "Custo da ida: estimativa pendente."
            : `Custo da ida ${brl(resumo.custoIdaCentavos)} · custo real da compra ${brl(resumo.custoRealCentavos as number)}`}
        </p>
      </Card>

      <Details titulo={`Comprado (${resumo.comprados})`} aberto>
        <ul className="flex flex-col gap-1 text-sm">
          {r.comprados.map((c) => (
            <li key={c.item.id} className="flex justify-between gap-2">
              <span>{nome(c.item.produtoId, c.item.nomeAvulso)}</span>
              <span>{numeroBR(c.itensNota.reduce((s, n) => s + n.quantidade, 0))}</span>
            </li>
          ))}
        </ul>
      </Details>

      <Details titulo={`Faltou (${resumo.faltou})`} aberto={resumo.faltou > 0}>
        {resumo.faltou ? <p className="mb-2 text-sm text-suave">Ficaram pendentes e voltam na próxima ida.</p> : <p className="text-sm">Tudo da lista foi comprado.</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {r.ficouDeFora.map((i) => (
            <li key={i.id}>{nome(i.produtoId, i.nomeAvulso)}</li>
          ))}
        </ul>
      </Details>

      <Details titulo={`Fora da lista (${resumo.foraDaLista})`} aberto={resumo.foraDaLista > 0}>
        {resumo.emergencias > 0 ? (
          <Alert tipo="aviso" className="mb-2">
            {resumo.emergencias} {resumo.emergencias === 1 ? "item conta" : "itens contam"} como compra de emergência (fora da lista numa ida de reposição).
          </Alert>
        ) : null}
        <ul className="flex flex-col gap-1 text-sm">
          {r.foraDaLista.map((n) => (
            <li key={n.codigo} className="flex items-center justify-between gap-2">
              <span>{nome(n.produtoId, n.descricao)}</span>
              {reposicao ? <Badge tom="aviso">emergência</Badge> : null}
            </li>
          ))}
        </ul>
      </Details>

      <LinkBotao href="/compras" variante="secundario">
        Ver compras
      </LinkBotao>
    </div>
  );
}
