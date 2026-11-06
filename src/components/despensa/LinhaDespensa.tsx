"use client";

import { useState } from "react";
import { Badge, Button, Card, Details, Dialog, Input } from "@/components/ui";
import { liberarMetaAutomatica } from "@/data/catalogo";
import { definirQuantidade, deixarDeRepor, reporSempre } from "@/data/despensa";
import { criarRepositorios } from "@/data";
import { situacaoDoItem } from "@/domain/despensa";
import { passoDaUnidade } from "@/domain/lista";
import { padraoSugerido } from "@/domain/recorrencia";
import type { Compra, Mercado, Produto } from "@/domain/types";
import { HistoricoDoItem } from "@/components/precos/HistoricoDoItem";
import { FormProduto } from "@/components/catalogo/FormProduto";
import { lerQuantidade, type LinhaDespensa } from "@/lib/despensaVisao";
import { numeroBR } from "@/lib/format";
import { UNIDADE_ROTULO } from "@/lib/rotulos";

const SITUACAO: Record<LinhaDespensa["situacao"], { texto: string; tom: "neutro" | "info" | "sucesso" | "aviso" | "erro" }> = {
  sem_registro: { texto: "Sem quantidade", tom: "neutro" },
  zerado: { texto: "Zerado", tom: "erro" },
  abaixo: { texto: "Menos da metade", tom: "aviso" },
  parcial: { texto: "Abaixo do padrão", tom: "neutro" },
  ok: { texto: "No padrão", tom: "sucesso" },
  acima: { texto: "Acima do padrão", tom: "info" },
};

type Props = {
  linha: LinhaDespensa;
  compras: readonly Compra[];
  mercados: readonly Mercado[];
  aoSalvarProduto: (original: Produto, novo: Produto) => Promise<void>;
  aoArquivar: (p: Produto) => void;
  aoMesclar: (p: Produto) => void;
  aoAvisar: (texto: string, tipo?: "ok" | "erro") => void;
};

export function LinhaDespensaItem({ linha, compras, mercados, aoSalvarProduto, aoArquivar, aoMesclar, aoAvisar }: Props) {
  const p = linha.produto;
  const unidade = UNIDADE_ROTULO[p.unidade];
  const passo = passoDaUnidade(p.unidade);
  const [exata, setExata] = useState("");
  const [ajustando, setAjustando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [promovendo, setPromovendo] = useState(false);
  const [padrao, setPadrao] = useState("");
  const s = SITUACAO[linha.situacao];

  async function gravar(quantidade: number): Promise<void> {
    await definirQuantidade(await criarRepositorios(), p, quantidade);
  }

  const atual = linha.atual ?? 0;
  const novaQuantidade = lerQuantidade(exata);
  const abrirAjuste = () => {
    setExata(linha.atual === undefined ? "" : numeroBR(linha.atual));
    setAjustando(true);
  };
  const efeito = (() => {
    if (novaQuantidade === undefined) return undefined;
    const quando = situacaoDoItem(p, { quantidade: novaQuantidade });
    if (!p.recorrente) return undefined;
    return quando === "zerado" || quando === "abaixo" ? "Com essa quantidade, o item vai para a lista de compras." : "Com essa quantidade, o item não entra na lista.";
  })();
  const abrirPromocao = () => {
    setPadrao(numeroBR(padraoSugerido(p, compras) ?? 0));
    setPromovendo(true);
  };

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{p.nome}</p>
          <p className="numero text-sm text-suave" data-testid="quantidade">
            {linha.atual === undefined ? "—" : numeroBR(linha.atual)}
            {linha.padrao !== undefined ? ` de ${numeroBR(linha.padrao)}` : ""} {unidade}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <Badge tom={s.tom}>{s.texto}</Badge>
          {p.recorrente ? <Badge tom="info">Recorrente</Badge> : <Badge>Eventual</Badge>}
          {p.ativo ? null : <Badge>Arquivado</Badge>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variante="secundario" aria-label={`Diminuir ${p.nome}`} disabled={atual <= 0} onClick={() => void gravar(Math.max(0, atual - passo))}>
          −
        </Button>
        <Button variante="secundario" aria-label={`Aumentar ${p.nome}`} onClick={() => void gravar(atual + passo)}>
          +
        </Button>
        <Button variante="secundario" onClick={abrirAjuste}>
          Ajustar
        </Button>
        <Button variante="secundario" onClick={() => setEditando(true)}>
          Editar
        </Button>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={p.recorrente}
          onChange={async (e) => {
            if (e.target.checked) return abrirPromocao();
            await deixarDeRepor(await criarRepositorios(), p.id);
            aoAvisar("Não vai mais para a lista sozinho.");
          }}
        />
        Repor sempre
      </label>

      {linha.sugestao ? (
        <p className="text-sm text-suave">
          {linha.sugestao.motivo}{" "}
          {linha.sugestao.acao === "repor_sempre" ? (
            <button type="button" className="min-h-11 font-medium text-primario underline" onClick={abrirPromocao}>
              Repor sempre?
            </button>
          ) : (
            <button
              type="button"
              className="min-h-11 font-medium text-primario underline"
              onClick={async () => {
                await deixarDeRepor(await criarRepositorios(), p.id);
                aoAvisar("Não vai mais para a lista sozinho.");
              }}
            >
              Deixar de repor?
            </button>
          )}
        </p>
      ) : null}

      {ajustando ? (
        <Dialog
          aberto
          titulo={`Ajustar “${p.nome}”`}
          rotuloConfirmar="Salvar"
          confirmarDesabilitado={novaQuantidade === undefined}
          aoConfirmar={async () => {
            if (novaQuantidade === undefined) return;
            await gravar(novaQuantidade);
            setAjustando(false);
            aoAvisar("Quantidade atualizada.");
          }}
          aoCancelar={() => setAjustando(false)}
        >
          <div className="flex flex-col gap-3">
            <Input
              rotulo={`Quantidade atual (${unidade})`}
              inputMode="decimal"
              value={exata}
              onChange={(e) => setExata(e.target.value)}
              erro={novaQuantidade === undefined ? "Digite uma quantidade válida." : undefined}
              ajuda={linha.padrao !== undefined ? `Padrão: ${numeroBR(linha.padrao)} ${unidade}.` : "Sem quantidade padrão definida."}
            />
            {efeito ? <p data-testid="efeito-ajuste">{efeito}</p> : null}
          </div>
        </Dialog>
      ) : null}

      {editando ? (
        <Dialog aberto semRodape titulo={`Editar “${p.nome}”`} aoConfirmar={() => undefined} aoCancelar={() => setEditando(false)}>
          <div className="flex flex-col gap-4">
            <FormProduto
              key={JSON.stringify(p)}
              produto={p}
              mercados={mercados}
              aoSalvar={async (novo) => {
                await aoSalvarProduto(p, novo);
                setEditando(false);
              }}
              aoLiberarPadrao={async () => {
                await liberarMetaAutomatica(await criarRepositorios(), p.id);
                aoAvisar("O padrão voltou ao cálculo automático.");
              }}
            />
            <Details semBorda titulo="Preço e compras">
              <HistoricoDoItem produtoId={p.id} compras={compras} mercados={mercados} />
            </Details>
            <div className="flex flex-wrap gap-2">
              <Button
                variante="secundario"
                onClick={() => {
                  setEditando(false);
                  aoArquivar(p);
                }}
              >
                {p.ativo ? "Arquivar" : "Desarquivar"}
              </Button>
              <Button
                variante="secundario"
                onClick={() => {
                  setEditando(false);
                  aoMesclar(p);
                }}
              >
                Mesclar com outro
              </Button>
              <Button variante="secundario" onClick={() => setEditando(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}

      <Dialog
        aberto={promovendo}
        titulo={`Repor “${p.nome}” sempre`}
        rotuloConfirmar="Repor sempre"
        aoConfirmar={async () => {
          const q = lerQuantidade(padrao);
          setPromovendo(false);
          await reporSempre(await criarRepositorios(), p.id, q !== undefined && q > 0 ? q : undefined);
          aoAvisar("Pronto: quando faltar, vai para a lista.");
        }}
        aoCancelar={() => setPromovendo(false)}
      >
        <div className="flex flex-col gap-3">
          <p>Quando estiver abaixo do padrão ou zerado, entra na lista de compras.</p>
          <Input rotulo={`Quantidade padrão (${unidade})`} inputMode="decimal" value={padrao} onChange={(e) => setPadrao(e.target.value)} ajuda="Sugerida pelas suas compras. Pode ajustar." />
        </div>
      </Dialog>
    </Card>
  );
}
