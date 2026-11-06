"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Button, Dialog, EmptyState, Input, Select, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { mesclarProdutos, salvarProdutoEditado } from "@/data/catalogo";
import { useRepositorio } from "@/data/useRepositorio";
import { DuplicadosCatalogo } from "@/components/catalogo/DuplicadosCatalogo";
import type { Produto } from "@/domain/types";
import { agruparLinhas, filtrarLinhas, montarLinhas, resumirDespensa, type AgruparPor, type FiltroDespensa } from "@/lib/despensaVisao";
import { hojeRecife } from "@/lib/datas";
import { AdicionarItem } from "./AdicionarItem";
import { LinhaDespensaItem } from "./LinhaDespensa";

const FILTROS: { valor: FiltroDespensa; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "faltando", rotulo: "Faltando" },
  { valor: "zerados", rotulo: "Zerados" },
  { valor: "nao_recorrentes", rotulo: "Eventuais" },
  { valor: "sem_padrao", rotulo: "Sem padrão" },
];

export function Despensa() {
  const { mostrar } = useToast();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroDespensa>("todos");
  const [agrupar, setAgrupar] = useState<AgruparPor>("categoria");
  const [arquivados, setArquivados] = useState(false);
  const [mesclando, setMesclando] = useState<Produto | null>(null);
  const [destinoId, setDestinoId] = useState("");

  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const [produtos, estoques, compras, mercados] = await Promise.all([r.produtos.listar(), r.estoques.listar(), r.compras.listar(), r.mercados.listar()]);
    return { produtos, estoques, compras, mercados };
  }, ["produtos", "estoques", "compras", "mercados"]);

  const linhas = useMemo(() => (dados ? montarLinhas(dados.produtos, dados.estoques, dados.compras, hojeRecife()) : []), [dados]);
  const resumo = useMemo(() => resumirDespensa(linhas), [linhas]);
  const grupos = useMemo(() => agruparLinhas(filtrarLinhas(linhas, filtro, busca, arquivados), agrupar), [linhas, filtro, busca, arquivados, agrupar]);

  async function salvar(original: Produto, novo: Produto): Promise<void> {
    try {
      await salvarProdutoEditado(await criarRepositorios(), original, novo);
      mostrar("Item salvo.");
    } catch {
      mostrar("Não consegui salvar o item.", "erro");
    }
  }

  async function alternarArquivo(p: Produto): Promise<void> {
    await (await criarRepositorios()).produtos.salvar({ ...p, ativo: !p.ativo });
    mostrar(p.ativo ? "Item arquivado." : "Item restaurado.");
  }

  async function confirmarMesclagem(): Promise<void> {
    if (!mesclando || !destinoId) return;
    try {
      await mesclarProdutos(await criarRepositorios(), mesclando.id, destinoId);
      mostrar("Itens mesclados.");
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Não consegui mesclar.", "erro");
    }
    setMesclando(null);
    setDestinoId("");
  }

  if (carregando) return <p aria-live="polite">Carregando...</p>;

  const vazia = !dados?.produtos.length;
  return (
    <>
      {vazia ? (
        <EmptyState
          titulo="A despensa está vazia"
          acao={
            <Link href="/importar" className="inline-flex min-h-11 items-center font-medium text-primario underline">
              Atualizar pela nota
            </Link>
          }
        >
          Adicione os itens abaixo ou importe uma nota: os itens dela entram na despensa.
        </EmptyState>
      ) : (
        <section aria-label="Resumo da despensa" className="flex flex-col gap-2">
          <p className="text-sm" data-testid="resumo-despensa">
            {resumo.itens} {resumo.itens === 1 ? "item" : "itens"} · {resumo.zerados} {resumo.zerados === 1 ? "zerado" : "zerados"} · {resumo.abaixo} com menos da metade
          </p>
          {resumo.naoRecorrentesZerados ? (
            <Alert tipo="info">
              {resumo.naoRecorrentesZerados} {resumo.naoRecorrentesZerados === 1 ? "item eventual acabou" : "itens eventuais acabaram"} e não vão para a lista. Em “Eventuais”, toque em
              “Repor sempre” nos que você compra sempre.
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link href="/lista" className="inline-flex min-h-11 items-center font-medium text-primario underline">
              Ver lista de compras
            </Link>
            <Link href="/importar" className="inline-flex min-h-11 items-center font-medium text-primario underline">
              Atualizar pela nota
            </Link>
          </div>
        </section>
      )}

      <AdicionarItem aoCriar={(nome) => mostrar(`“${nome}” entrou na despensa.`)} />

      {vazia ? null : (
        <>
          <DuplicadosCatalogo produtos={dados.produtos} compras={dados.compras} />
          <div className="flex flex-col gap-2">
            <Input rotulo="Buscar item" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <div role="group" aria-label="Filtrar itens" className="flex flex-wrap gap-2">
              {FILTROS.map((f) => (
                <Button key={f.valor} variante={filtro === f.valor ? "primario" : "secundario"} aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}>
                  {f.rotulo}
                </Button>
              ))}
            </div>
            <Select rotulo="Agrupar por" value={agrupar} onChange={(e) => setAgrupar(e.target.value as AgruparPor)}>
              <option value="categoria">Categoria</option>
              <option value="local">Local da casa</option>
            </Select>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} />
              Mostrar arquivados
            </label>
          </div>

          {grupos.length === 0 ? <p className="text-sm text-suave">Nenhum item encontrado.</p> : null}

          {grupos.map((g) => (
            <section key={g.chave} aria-labelledby={`grupo-${g.chave}`} className="flex flex-col gap-2">
              <h2 id={`grupo-${g.chave}`} className="text-sm">
                {g.titulo}
              </h2>
              <ul className="flex flex-col gap-2">
                {g.linhas.map((l) => (
                  <li key={l.produto.id}>
                    <LinhaDespensaItem
                      linha={l}
                      compras={dados.compras}
                      mercados={dados.mercados}
                      aoSalvarProduto={salvar}
                      aoArquivar={(p) => void alternarArquivo(p)}
                      aoMesclar={setMesclando}
                      aoAvisar={(t, tipo) => mostrar(t, tipo === "erro" ? "erro" : undefined)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <Dialog
        aberto={mesclando !== null}
        titulo={mesclando ? `Mesclar "${mesclando.nome}"` : "Mesclar"}
        rotuloConfirmar="Mesclar"
        perigo
        aoConfirmar={() => void confirmarMesclagem()}
        aoCancelar={() => {
          setMesclando(null);
          setDestinoId("");
        }}
      >
        <div className="flex flex-col gap-3">
          <p>O histórico, os apelidos e a quantidade passam para o item escolhido, e &quot;{mesclando?.nome}&quot; deixa de existir.</p>
          <Select rotulo="Mesclar em" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
            <option value="">Escolha…</option>
            {(dados?.produtos ?? [])
              .filter((x) => x.id !== mesclando?.id)
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
          </Select>
        </div>
      </Dialog>
    </>
  );
}
