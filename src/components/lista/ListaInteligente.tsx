"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Details, EmptyState, Input, LinkBotao, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { adicionarAvulso, alterarQuantidade, dividirLista, garantirListaDaCasa, removerItem, restaurarItem } from "@/data/lista";
import { useRepositorio } from "@/data/useRepositorio";
import { estimarCusto } from "@/domain/lista";
import { melhorMercadoPorProduto } from "@/domain/comparacao";
import { avisoIdaPoucoVantajosa, mercadoHabitualDaCasa, proporDivisao } from "@/domain/economia";
import { custoIdaDoMercado } from "@/domain/ida";
import { alertasPorProduto } from "@/domain/precos";
import { agruparPorCategoria, agruparPorMercado, temMercadosDiferentes, type ItemVisao } from "@/lib/agruparLista";
import { hojeRecife } from "@/lib/datas";
import { brl } from "@/lib/format";
import { ItemDaLista } from "./ItemDaLista";

export function ListaInteligente() {
  const { mostrar } = useToast();
  const [listaId, setListaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [porMercado, setPorMercado] = useState(false);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  async function gerar(): Promise<void> {
    setErro(null);
    try {
      const { lista } = await garantirListaDaCasa(await criarRepositorios(), hojeRecife());
      setListaId(lista.id);
    } catch {
      setListaId(null);
      setErro("Não consegui gerar a lista.");
    }
  }

  useEffect(() => {
    (async () => {
      const repos = await criarRepositorios();
      const pedida = new URLSearchParams(location.search).get("lista");
      const listaPedida = pedida ? await repos.listas.obter(pedida) : undefined;
      if (listaPedida) setListaId(listaPedida.id);
      else await gerar();
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
  if (!dados?.lista) return <p aria-live="polite">Carregando...</p>;
  const { lista } = dados;
  const nomeDoItem = (id: string): string => {
    const it = dados.itens.find((x) => x.id === id);
    return (it?.produtoId && dados.produtos.get(it.produtoId)?.nome) || it?.nomeAvulso || "";
  };

  const nomeMercado = (id?: string): string => {
    const m = dados.mercados.find((x) => x.id === id);
    return m?.apelido || m?.nome || "outro mercado";
  };
  const irmas = dados.listas.filter((l) => l.id !== lista.id && l.status !== "fechada");
  const sugestoes = (() => {
    const perfil = dados.perfil;
    const habitualId = lista.mercadoId ?? mercadoHabitualDaCasa(dados.agendas, dados.compras);
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
          ? `Esta ida tem ${visiveis.length} ${visiveis.length === 1 ? "item" : "itens"}, ${brl(estimativa.totalCentavos)}, e custa ${brl(custoIda)} para ir e voltar. Vale esperar e juntar com outra compra?`
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
      <Card className="flex flex-col gap-1">
        <p className="text-sm text-suave">Lista da casa: o que está zerado ou abaixo do padrão</p>
        <p className="text-2xl font-semibold" aria-label="Estimativa de custo">
          {brl(estimativa.totalCentavos)}
        </p>
        <p className="text-sm">{visiveis.length} {visiveis.length === 1 ? "item" : "itens"} · estimativa pelo último preço pago</p>
        {estimativa.semPreco.length ? (
          <Details titulo={`Sem preço (${estimativa.semPreco.length})`} className="mt-2">
            <p className="text-sm text-suave">Ficam fora da soma:</p>
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
        <EmptyState titulo="Nada faltando">
          Os itens recorrentes zerados ou abaixo do padrão aparecem aqui. Ajuste as quantidades na despensa ou adicione itens avulsos abaixo.
          <Link href="/despensa" className="mt-2 inline-flex min-h-11 items-center font-medium text-primario underline">
            Ir para a despensa
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
          <h2 id={`g-${g.titulo}`} className="text-sm">
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
        <h2 className="text-sm">Adicionar item avulso</h2>
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
            await gerar();
            mostrar("Lista atualizada. Suas edições foram mantidas.");
          }}
        >
          Regerar lista
        </Button>
        <LinkBotao href={`/compra?lista=${lista.id}`}>Iniciar compra</LinkBotao>
      </div>
    </div>
  );
}
