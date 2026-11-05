"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Details, EmptyState, Input, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { adicionarAvulso, alterarQuantidade, garantirLista, removerItem, restaurarItem, SemAgendaError, tipoMaisProximo } from "@/data/lista";
import { useRepositorio } from "@/data/useRepositorio";
import { proximaIdaDoTipo } from "@/domain/agenda";
import { estimarCusto } from "@/domain/lista";
import { alertasPorProduto } from "@/domain/precos";
import type { TipoIda } from "@/domain/types";
import { TIPOS_IDA } from "@/schemas";
import { agruparPorCategoria, agruparPorMercado, temMercadosDiferentes, type ItemVisao } from "@/lib/agruparLista";
import { hojeRecife } from "@/lib/datas";
import { brl, dataBR } from "@/lib/format";
import { TIPO_IDA_ROTULO } from "@/lib/rotulos";
import { ItemDaLista } from "./ItemDaLista";

export function ListaInteligente() {
  const { mostrar } = useToast();
  const [tipo, setTipo] = useState<TipoIda | null>(null);
  const [listaId, setListaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [porMercado, setPorMercado] = useState(false);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  async function gerar(t: TipoIda): Promise<void> {
    setErro(null);
    try {
      const l = await garantirLista(await criarRepositorios(), t, hojeRecife());
      setTipo(t);
      setListaId(l.id);
    } catch (e) {
      setListaId(null);
      setErro(e instanceof SemAgendaError ? e.message : "Não consegui gerar a lista.");
    }
  }

  useEffect(() => {
    (async () => {
      const repos = await criarRepositorios();
      const pedido = new URLSearchParams(location.search).get("ida");
      const inicial = (TIPOS_IDA as readonly string[]).includes(pedido ?? "") ? (pedido as TipoIda) : await tipoMaisProximo(repos, hojeRecife());
      if (inicial) await gerar(inicial);
      else setErro("Nenhuma agenda de ida configurada. Defina as datas em Ajustes.");
    })();
  }, []);

  const { dados } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const casa = await r.iniciar();
    const [lista, itens, produtos, mercados, compras, agendas, perfil] = await Promise.all([
      listaId ? r.listas.obter(listaId) : undefined,
      listaId ? r.itensLista.listarPorLista(listaId) : [],
      r.produtos.listar(),
      r.mercados.listar(),
      r.compras.listar(),
      r.agendas.listar(),
      r.perfis.obterDaCasa(casa.id),
    ]);
    return { lista, itens, produtos: new Map(produtos.map((p) => [p.id, p])), mercados, compras, agendas, alertas: alertasPorProduto(compras, perfil?.limiarAlertaPrecoPct ?? 20) };
  }, ["listas", "itensLista", "produtos", "mercados", "compras", "agendas"], [listaId]);

  const visiveis = useMemo<ItemVisao[]>(
    () => (dados?.itens ?? []).filter((i) => !i.removido).map((item) => ({ item, produto: item.produtoId ? dados?.produtos.get(item.produtoId) : undefined })),
    [dados],
  );
  const removidos = (dados?.itens ?? []).filter((i) => i.removido);
  const estimativa = useMemo(() => estimarCusto(dados?.itens ?? [], dados?.compras ?? []), [dados]);
  const grupos = useMemo(
    () => (porMercado && dados ? agruparPorMercado(visiveis, dados.mercados) : agruparPorCategoria(visiveis)),
    [porMercado, visiveis, dados],
  );

  if (erro && !dados?.lista) return <Alert tipo="erro">{erro}</Alert>;
  if (!tipo || !dados?.lista) return <p aria-live="polite">Carregando...</p>;
  const { lista } = dados;
  const nomeDoItem = (id: string): string => {
    const it = dados.itens.find((x) => x.id === id);
    return (it?.produtoId && dados.produtos.get(it.produtoId)?.nome) || it?.nomeAvulso || "";
  };

  async function adicionar(): Promise<void> {
    const q = Number(quantidade.replace(",", "."));
    if (!nome.trim() || !Number.isFinite(q) || q <= 0) return setErro("Informe o nome e uma quantidade maior que zero.");
    setErro(null);
    await adicionarAvulso(await criarRepositorios(), lista!, nome, q);
    setNome("");
    setQuantidade("1");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Tipo de ida">
        {TIPOS_IDA.map((t) => {
          const ida = proximaIdaDoTipo(dados.agendas, t, hojeRecife());
          return (
            <Button
              key={t}
              variante={t === tipo ? "primario" : "secundario"}
              aria-pressed={t === tipo}
              className="h-auto flex-col py-2 text-sm"
              disabled={!ida}
              onClick={() => void gerar(t)}
            >
              {TIPO_IDA_ROTULO[t]}
              <span className="text-xs font-normal">{ida ? dataBR(ida.data) : "sem agenda"}</span>
            </Button>
          );
        })}
      </div>

      <Card className="flex flex-col gap-1">
        <p className="text-sm text-texto/70">
          {TIPO_IDA_ROTULO[lista.tipoIda]} · {dataBR(lista.data)}
        </p>
        <p className="text-2xl font-semibold" aria-label="Estimativa de custo">
          {brl(estimativa.totalCentavos)}
        </p>
        <p className="text-sm">{visiveis.length} {visiveis.length === 1 ? "item" : "itens"} · estimativa pelo último preço pago</p>
        {estimativa.semPreco.length ? (
          <Details titulo={`Sem preço (${estimativa.semPreco.length})`} className="mt-2">
            <p className="text-sm text-texto/70">Ficam fora da soma:</p>
            <ul className="list-disc pl-5 text-sm">
              {estimativa.semPreco.map((id) => (
                <li key={id}>{nomeDoItem(id)}</li>
              ))}
            </ul>
          </Details>
        ) : null}
      </Card>

      {erro ? <Alert tipo="erro">{erro}</Alert> : null}

      {visiveis.length === 0 ? (
        <EmptyState titulo="Nenhum item na lista">
          Confira a despensa para o app saber o que falta, ou adicione itens avulsos abaixo.
          <Link href={`/conferencia?ida=${tipo}`} className="mt-2 inline-flex min-h-11 items-center font-medium text-verde underline">
            Conferir despensa
          </Link>
        </EmptyState>
      ) : null}

      {temMercadosDiferentes(visiveis) ? (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={porMercado} onChange={(e) => setPorMercado(e.target.checked)} />
          Separar por mercado preferido
        </label>
      ) : null}

      {grupos.map((g) => (
        <section key={g.titulo} aria-labelledby={`g-${g.titulo}`} className="flex flex-col gap-2">
          <h2 id={`g-${g.titulo}`} className="text-lg font-semibold">
            {g.titulo}
          </h2>
          <ul className="flex flex-col gap-2">
            {g.itens.map(({ item, produto }) => (
              <ItemDaLista
                key={item.id}
                item={item}
                produto={produto}
                alerta={item.produtoId ? dados.alertas.get(item.produtoId) : undefined}
                aoAlterar={async (q) => void (await alterarQuantidade(await criarRepositorios(), item, q))}
                aoRemover={async () => void (await removerItem(await criarRepositorios(), item))}
              />
            ))}
          </ul>
        </section>
      ))}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Adicionar item avulso</h2>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Input rotulo="Nome do item" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input rotulo="Quantidade" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </div>
        <Button variante="secundario" onClick={() => void adicionar()}>
          Adicionar
        </Button>
      </Card>

      {removidos.length ? (
        <Details titulo={`Removidos (${removidos.length})`}>
          <ul className="flex flex-col gap-2">
            {removidos.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span>{nomeDoItem(i.id)}</span>
                <Button variante="secundario" onClick={async () => void (await restaurarItem(await criarRepositorios(), i))}>
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </Details>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button
          variante="secundario"
          onClick={async () => {
            await gerar(tipo);
            mostrar("Lista atualizada. Suas edições foram mantidas.");
          }}
        >
          Regerar lista
        </Button>
        <Link
          href={`/compra?lista=${lista.id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-verde px-4 py-2 font-medium text-white"
        >
          Iniciar compra
        </Link>
      </div>
    </div>
  );
}
