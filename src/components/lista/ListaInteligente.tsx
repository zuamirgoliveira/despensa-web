"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Details, EmptyState, Input, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { adicionarAvulso, alterarQuantidade, dividirLista, garantirLista, removerItem, restaurarItem, SemAgendaError, tipoMaisProximo } from "@/data/lista";
import { useRepositorio } from "@/data/useRepositorio";
import { proximaIdaDoTipo } from "@/domain/agenda";
import { estimarCusto } from "@/domain/lista";
import { melhorMercadoPorProduto } from "@/domain/comparacao";
import { avisoIdaPoucoVantajosa, mercadoHabitual, proporDivisao } from "@/domain/economia";
import { custoIdaDoMercado } from "@/domain/ida";
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
      const params = new URLSearchParams(location.search);
      const listaPedida = params.get("lista") ? await repos.listas.obter(params.get("lista") as string) : undefined;
      if (listaPedida) {
        setTipo(listaPedida.tipoIda);
        setListaId(listaPedida.id);
        return;
      }
      const pedido = params.get("ida");
      const inicial = (TIPOS_IDA as readonly string[]).includes(pedido ?? "") ? (pedido as TipoIda) : await tipoMaisProximo(repos, hojeRecife());
      if (inicial) await gerar(inicial);
      else setErro("Nenhuma agenda de ida configurada. Defina as datas em Ajustes.");
    })();
  }, []);

  const { dados } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const casa = await r.iniciar();
    const [lista, itens, produtos, mercados, compras, agendas, perfil, listas] = await Promise.all([
      listaId ? r.listas.obter(listaId) : undefined,
      listaId ? r.itensLista.listarPorLista(listaId) : [],
      r.produtos.listar(),
      r.mercados.listar(),
      r.compras.listar(),
      r.agendas.listar(),
      r.perfis.obterDaCasa(casa.id),
      r.listas.listar(),
    ]);
    return { lista, itens, produtos: new Map(produtos.map((p) => [p.id, p])), mercados, compras, agendas, perfil, listas, alertas: alertasPorProduto(compras, perfil?.limiarAlertaPrecoPct ?? 20) };
  }, ["listas", "itensLista", "produtos", "mercados", "compras", "agendas", "perfis"], [listaId]);

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

  const nomeMercado = (id?: string): string => {
    const m = dados.mercados.find((x) => x.id === id);
    return m?.apelido || m?.nome || "outro mercado";
  };
  const irmas = dados.listas.filter((l) => l.id !== lista.id && l.tipoIda === lista.tipoIda && l.data === lista.data && l.status !== "fechada");
  const sugestoes = (() => {
    const perfil = dados.perfil;
    const habitualId = lista.mercadoId ?? mercadoHabitual(dados.agendas, lista.tipoIda, dados.compras);
    if (!perfil || !habitualId) return { aviso: undefined, divisao: undefined };
    const habitual = dados.mercados.find((m) => m.id === habitualId);
    const custoIda = habitual ? custoIdaDoMercado(habitual, perfil) : undefined;
    const aviso =
      custoIda !== undefined && visiveis.length > 0
        ? avisoIdaPoucoVantajosa({ itens: visiveis.length, totalEstimadoCentavos: estimativa.totalCentavos, custoIdaCentavos: custoIda })
        : undefined;
    const comparacoes = melhorMercadoPorProduto(dados.compras, hojeRecife(), perfil.janelaPrecoDias);
    const p = lista.mercadoId ? undefined : proporDivisao({ itens: visiveis.map((v) => v.item), habitualId, mercados: dados.mercados, comparacoes, perfil });
    return {
      aviso:
        aviso && custoIda !== undefined
          ? `Esta ida tem ${visiveis.length} ${visiveis.length === 1 ? "item" : "itens"}, ${brl(estimativa.totalCentavos)}, e custa ${brl(custoIda)} para ir e voltar. ${
              lista.tipoIda === "feira_mensal" ? "Vale juntar com outra ida?" : "Dá para esperar a feira mensal?"
            }`
          : undefined,
      divisao: p ? { p, habitualId, habitual: nomeMercado(habitualId), alternativo: nomeMercado(p.mercadoAlternativoId) } : undefined,
    };
  })();

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

      {sugestoes.aviso ? <Alert tipo="aviso">{sugestoes.aviso}</Alert> : null}
      {sugestoes.divisao ? (
        <Alert tipo="info">
          <p>
            Dividir a lista entre {sugestoes.divisao.habitual} e {sugestoes.divisao.alternativo} economiza {brl(sugestoes.divisao.p.economiaLiquidaCentavos)} líquidos
            ({brl(sugestoes.divisao.p.economiaPrecoCentavos)} de preço menos {brl(sugestoes.divisao.p.custoIdaExtraCentavos)} da ida extra).
          </p>
          <Button
            variante="secundario"
            className="mt-2"
            onClick={async () => {
              const d = sugestoes.divisao;
              if (!d) return;
              await dividirLista(await criarRepositorios(), lista, d.habitualId, d.p.mercadoAlternativoId, d.p.produtoIds);
              mostrar(`Lista dividida: ${d.p.produtoIds.length} itens foram para ${d.alternativo}.`);
            }}
          >
            Dividir lista
          </Button>
        </Alert>
      ) : null}
      {irmas.length ? (
        <div className="flex flex-col gap-1" aria-label="Outras listas desta ida">
          {irmas.map((l) => (
            <Button key={l.id} variante="secundario" onClick={() => setListaId(l.id)}>
              Ver a lista de {nomeMercado(l.mercadoId)}
            </Button>
          ))}
        </div>
      ) : null}

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
