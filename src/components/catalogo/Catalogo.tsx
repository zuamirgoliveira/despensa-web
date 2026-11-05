"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Details, Dialog, EmptyState, Input, Select, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { liberarMetaAutomatica, mesclarProdutos, salvarProdutoEditado } from "@/data/catalogo";
import { useRepositorio } from "@/data/useRepositorio";
import { chaveDeNome, sugestaoDeTipoDeIda } from "@/domain/catalogo";
import type { Produto } from "@/domain/types";
import { CATEGORIAS } from "@/schemas";
import { CATEGORIA_ROTULO, TIPO_IDA_ROTULO, UNIDADE_ROTULO } from "@/lib/rotulos";
import { numeroBR } from "@/lib/format";
import { FormProduto } from "./FormProduto";

export function Catalogo() {
  const { mostrar } = useToast();
  const [busca, setBusca] = useState("");
  const [arquivados, setArquivados] = useState(false);
  const [mesclando, setMesclando] = useState<Produto | null>(null);
  const [destinoId, setDestinoId] = useState("");

  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const [produtos, mercados, compras] = await Promise.all([r.produtos.listar(), r.mercados.listar(), r.compras.listar()]);
    return { produtos, mercados, compras };
  }, ["produtos", "mercados", "compras"]);

  const grupos = useMemo(() => {
    const termo = chaveDeNome(busca);
    const visiveis = (dados?.produtos ?? []).filter((p) => (arquivados || p.ativo) && chaveDeNome(p.nome).includes(termo));
    return CATEGORIAS.map((c) => ({
      categoria: c,
      produtos: visiveis.filter((p) => p.categoria === c).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    })).filter((g) => g.produtos.length);
  }, [dados, busca, arquivados]);

  async function salvar(original: Produto, novo: Produto): Promise<void> {
    try {
      await salvarProdutoEditado(await criarRepositorios(), original, novo);
      mostrar("Produto salvo.");
    } catch {
      mostrar("Não consegui salvar o produto.", "erro");
    }
  }

  async function alternarArquivo(p: Produto): Promise<void> {
    await (await criarRepositorios()).produtos.salvar({ ...p, ativo: !p.ativo });
    mostrar(p.ativo ? "Produto arquivado." : "Produto restaurado.");
  }

  async function confirmarMesclagem(): Promise<void> {
    if (!mesclando || !destinoId) return;
    try {
      await mesclarProdutos(await criarRepositorios(), mesclando.id, destinoId);
      mostrar("Produtos mesclados.");
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Não consegui mesclar.", "erro");
    }
    setMesclando(null);
    setDestinoId("");
  }

  if (carregando) return <p aria-live="polite">Carregando...</p>;
  if (!dados?.produtos.length) {
    return (
      <EmptyState
        titulo="O catálogo está vazio"
        acao={
          <Link href="/importar" className="inline-flex min-h-11 items-center font-medium text-verde underline">
            Importar uma nota
          </Link>
        }
      >
        Os produtos nascem das notas que você importa.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Input rotulo="Buscar produto" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} />
          Mostrar arquivados
        </label>
      </div>

      {grupos.length === 0 ? <p className="text-sm text-texto/70">Nenhum produto encontrado.</p> : null}

      {grupos.map((g) => (
        <section key={g.categoria} aria-labelledby={`cat-${g.categoria}`} className="flex flex-col gap-2">
          <h2 id={`cat-${g.categoria}`} className="text-lg font-semibold">
            {CATEGORIA_ROTULO[g.categoria]}
          </h2>
          <ul className="flex flex-col gap-2">
            {g.produtos.map((p) => {
              const sugestao = sugestaoDeTipoDeIda(p, dados.compras);
              return (
                <li key={p.id}>
                  <Card className="p-3">
                    <Details
                      titulo={
                        <span className="flex w-full items-center justify-between gap-2">
                          <span>{p.nome}</span>
                          <span className="flex items-center gap-2 text-sm font-normal text-texto/70">
                            {p.ativo ? null : <Badge>arquivado</Badge>}
                            {numeroBR(p.meta)} {UNIDADE_ROTULO[p.unidade]} · {TIPO_IDA_ROTULO[p.tipoIda]}
                          </span>
                        </span>
                      }
                    >
                      <div className="flex flex-col gap-3">
                        {sugestao ? (
                          <Alert tipo="info">
                            <p>{sugestao.motivo}</p>
                            <Button
                              variante="secundario"
                              className="mt-2"
                              onClick={() => void salvar(p, { ...p, tipoIda: sugestao.tipoIda })}
                            >
                              Levar para a feira mensal
                            </Button>
                          </Alert>
                        ) : null}
                        <FormProduto key={JSON.stringify(p)} produto={p} mercados={dados.mercados} aoSalvar={(novo) => salvar(p, novo)} />
                        <div className="flex flex-wrap gap-2">
                          {p.metaManual ? (
                            <Button
                              variante="secundario"
                              onClick={async () => {
                                await liberarMetaAutomatica(await criarRepositorios(), p.id);
                                mostrar("Meta voltou ao cálculo automático.");
                              }}
                            >
                              Meta automática
                            </Button>
                          ) : null}
                          <Button variante="secundario" onClick={() => void alternarArquivo(p)}>
                            {p.ativo ? "Arquivar" : "Desarquivar"}
                          </Button>
                          <Button variante="secundario" onClick={() => setMesclando(p)}>
                            Mesclar com outro
                          </Button>
                        </div>
                      </div>
                    </Details>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

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
          <p>
            O histórico, os apelidos e o estoque passam para o produto escolhido, e &quot;{mesclando?.nome}&quot; deixa de existir.
          </p>
          <Select rotulo="Mesclar em" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
            <option value="">Escolha…</option>
            {dados.produtos
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
