"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, EmptyState, Input, Progress } from "@/components/ui";
import { criarRepositorios } from "@/data";
import {
  adicionarExtra, alternarPego, definirOrcamento, definirPreco, definirQuantidadePega, iniciarCompra, marcarEstado, removerDaCompra,
} from "@/data/compra";
import { useRepositorio } from "@/data/useRepositorio";
import { estadoDoOrcamento, ordenarParaCompra, progressoDaCompra, totalCorrente } from "@/domain/compra";
import { agruparPorCategoria, type ItemVisao } from "@/lib/agruparLista";
import { centavosParaCampo, reaisParaCentavos } from "@/lib/dinheiro";
import { brl, dataBR } from "@/lib/format";
import { TIPO_IDA_ROTULO } from "@/lib/rotulos";
import { manterTelaAcesa } from "@/lib/wakeLock";
import { LinhaDaCompra } from "./LinhaDaCompra";

export function ModoCompra() {
  const [listaId, setListaId] = useState<string | null>(null);
  const [semLista, setSemLista] = useState(false);
  const [orcamento, setOrcamento] = useState("");
  const [extra, setExtra] = useState({ nome: "", quantidade: "1", preco: "" });
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("lista");
    (async () => {
      const lista = id ? await iniciarCompra(await criarRepositorios(), id) : undefined;
      if (!lista) return setSemLista(true);
      setListaId(lista.id);
      setOrcamento(centavosParaCampo(lista.orcamentoCentavos));
    })();
    return manterTelaAcesa();
  }, []);

  const { dados } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const [lista, itens, produtos] = await Promise.all([
      listaId ? r.listas.obter(listaId) : undefined,
      listaId ? r.itensLista.listarPorLista(listaId) : [],
      r.produtos.listar(),
    ]);
    return { lista, itens, produtos: new Map(produtos.map((p) => [p.id, p])) };
  }, ["listas", "itensLista", "produtos"], [listaId]);

  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const total = totalCorrente(itens);
  const progresso = progressoDaCompra(itens);
  const estado = estadoDoOrcamento(total, dados?.lista?.orcamentoCentavos);
  const grupos = useMemo(() => {
    const visao: ItemVisao[] = itens
      .filter((i) => !i.removido)
      .map((item) => ({ item, produto: item.produtoId ? dados?.produtos.get(item.produtoId) : undefined }));
    return agruparPorCategoria(ordenarParaCompra(visao)).map((g) => ({ ...g, itens: ordenarParaCompra(g.itens) }));
  }, [itens, dados]);

  if (semLista) {
    return (
      <EmptyState titulo="Lista não encontrada" acao={<Link href="/lista" className="inline-flex min-h-11 items-center font-medium text-verde underline">Ir para a lista</Link>}>
        Abra o modo compra a partir de uma lista.
      </EmptyState>
    );
  }
  if (!dados?.lista) return <p aria-live="polite">Carregando...</p>;
  const lista = dados.lista;

  async function repos() {
    return criarRepositorios();
  }

  async function adicionar(): Promise<void> {
    const q = Number(extra.quantidade.replace(",", "."));
    if (!extra.nome.trim() || !Number.isFinite(q) || q <= 0) return setErro("Informe o nome e uma quantidade maior que zero.");
    setErro(null);
    await adicionarExtra(await repos(), lista, extra.nome, q, reaisParaCentavos(extra.preco));
    setExtra({ nome: "", quantidade: "1", preco: "" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-30 -mx-4 flex flex-col gap-2 border-b border-borda bg-fundo px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-texto/70">
            {TIPO_IDA_ROTULO[lista.tipoIda]} · {dataBR(lista.data)}
          </p>
          <p className="text-sm" aria-live="polite">
            {progresso.pegos} de {progresso.total} itens
          </p>
        </div>
        <Progress rotulo="Itens pegos" valor={progresso.pegos} maximo={Math.max(progresso.total, 1)} />
        <p className="text-2xl font-semibold" aria-label="Total corrente">
          {brl(total)}
          {lista.estimativaCentavos !== undefined ? (
            <span className="ml-2 text-sm font-normal text-texto/70">de {brl(lista.estimativaCentavos)} estimados</span>
          ) : null}
        </p>
        {estado === "estourou" ? <Alert tipo="erro">Passou do orçamento de {brl(lista.orcamentoCentavos as number)}.</Alert> : null}
        {estado === "perto" ? <Alert tipo="aviso">Perto do orçamento de {brl(lista.orcamentoCentavos as number)}.</Alert> : null}
      </div>

      {itens.filter((i) => !i.removido).length === 0 ? <EmptyState titulo="A lista está vazia">Adicione extras abaixo ou volte e gere a lista.</EmptyState> : null}

      {grupos.map((g) => (
        <section key={g.titulo} aria-labelledby={`g-${g.titulo}`} className="flex flex-col gap-2">
          <h2 id={`g-${g.titulo}`} className="text-lg font-semibold">
            {g.titulo}
          </h2>
          <ul className="flex flex-col gap-3">
            {g.itens.map(({ item, produto }) => (
              <LinhaDaCompra
                key={item.id}
                item={item}
                produto={produto}
                aoPegar={async () => void (await alternarPego(await repos(), item))}
                aoEstado={async (e) => void (await marcarEstado(await repos(), item, e))}
                aoQuantidade={async (q) => void (await definirQuantidadePega(await repos(), item, q))}
                aoPreco={async (c) => void (await definirPreco(await repos(), item, c))}
                aoRemover={async () => void (await removerDaCompra(await repos(), item))}
              />
            ))}
          </ul>
        </section>
      ))}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Adicionar extra</h2>
        <Input rotulo="Nome do extra" value={extra.nome} onChange={(e) => setExtra({ ...extra, nome: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input rotulo="Quantidade do extra" inputMode="decimal" value={extra.quantidade} onChange={(e) => setExtra({ ...extra, quantidade: e.target.value })} />
          <Input rotulo="Preço unitário do extra (opcional)" inputMode="decimal" value={extra.preco} onChange={(e) => setExtra({ ...extra, preco: e.target.value })} />
        </div>
        {erro ? <Alert tipo="erro">{erro}</Alert> : null}
        <Button variante="secundario" onClick={() => void adicionar()}>
          Adicionar extra
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <Input
          rotulo="Orçamento da compra (opcional)"
          inputMode="decimal"
          value={orcamento}
          placeholder="0,00"
          onChange={(e) => setOrcamento(e.target.value)}
          onBlur={async () => void (await definirOrcamento(await repos(), lista, reaisParaCentavos(orcamento)))}
          ajuda="Avisa quando o total corrente chegar perto ou passar."
        />
      </Card>

      <Link
        href={`/importar?lista=${lista.id}`}
        className="inline-flex min-h-14 items-center justify-center rounded-lg bg-verde px-4 py-2 text-lg font-medium text-white"
      >
        Terminar compra
      </Link>
    </div>
  );
}
