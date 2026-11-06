"use client";

import { useState } from "react";
import { Badge, Button, Card, Details, Dialog, Input } from "@/components/ui";
import { definirQuantidade, deixarDeRepor, reporSempre } from "@/data/despensa";
import { criarRepositorios } from "@/data";
import { quantidadeDoNivel } from "@/domain/despensa";
import { passoDaUnidade } from "@/domain/lista";
import { padraoSugerido } from "@/domain/recorrencia";
import type { Compra, Mercado, Produto } from "@/domain/types";
import { FormProduto } from "@/components/catalogo/FormProduto";
import { lerQuantidade, type LinhaDespensa } from "@/lib/despensaVisao";
import { numeroBR } from "@/lib/format";
import { UNIDADE_ROTULO } from "@/lib/rotulos";
import { NIVEIS } from "@/schemas";

const NIVEL_ROTULO = { cheio: "Cheio", metade: "Metade", acabando: "Acabando", acabou: "Acabou" } as const;

const SITUACAO: Record<LinhaDespensa["situacao"], { texto: string; tom: "neutro" | "info" | "sucesso" | "aviso" | "erro" }> = {
  sem_registro: { texto: "Sem quantidade", tom: "neutro" },
  zerado: { texto: "Zerado", tom: "erro" },
  abaixo: { texto: "Abaixo do padrão", tom: "aviso" },
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
  const [promovendo, setPromovendo] = useState(false);
  const [padrao, setPadrao] = useState("");
  const s = SITUACAO[linha.situacao];

  async function gravar(quantidade: number): Promise<void> {
    await definirQuantidade(await criarRepositorios(), p, quantidade);
  }

  const atual = linha.atual ?? 0;
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
        {!p.recorrente ? (
          <Button variante="secundario" onClick={abrirPromocao}>
            Repor sempre
          </Button>
        ) : null}
      </div>

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

      <Details semBorda titulo="Ajustar e editar">
        <div className="flex flex-col gap-3">
          <div role="group" aria-label={`Atalhos de quantidade de ${p.nome}`} className="flex flex-wrap gap-2">
            {NIVEIS.map((n) => (
              <Button key={n} variante="secundario" disabled={linha.padrao === undefined} onClick={() => void gravar(quantidadeDoNivel(n, linha.padrao ?? 0))}>
                {NIVEL_ROTULO[n]}
              </Button>
            ))}
          </div>
          {linha.padrao === undefined ? <p className="text-xs text-suave">Defina a quantidade padrão para usar os atalhos.</p> : null}
          <form
            className="flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const q = lerQuantidade(exata);
              if (q === undefined) return aoAvisar("Digite uma quantidade válida.", "erro");
              await gravar(q);
              setExata("");
              aoAvisar("Quantidade atualizada.");
            }}
          >
            <Input rotulo={`Quantidade atual (${unidade})`} inputMode="decimal" value={exata} onChange={(e) => setExata(e.target.value)} />
            <Button type="submit" variante="secundario">
              Definir
            </Button>
          </form>
          <Details semBorda titulo="Mais opções">
            <div className="flex flex-col gap-3">
              <FormProduto key={JSON.stringify(p)} produto={p} mercados={mercados} aoSalvar={(novo) => aoSalvarProduto(p, novo)} />
              <div className="flex flex-wrap gap-2">
                {p.recorrente ? (
                  <Button
                    variante="secundario"
                    onClick={async () => {
                      await deixarDeRepor(await criarRepositorios(), p.id);
                      aoAvisar("Não vai mais para a lista sozinho.");
                    }}
                  >
                    Deixar de repor
                  </Button>
                ) : null}
                <Button variante="secundario" onClick={() => aoArquivar(p)}>
                  {p.ativo ? "Arquivar" : "Desarquivar"}
                </Button>
                <Button variante="secundario" onClick={() => aoMesclar(p)}>
                  Mesclar com outro
                </Button>
              </div>
            </div>
          </Details>
        </div>
      </Details>

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
