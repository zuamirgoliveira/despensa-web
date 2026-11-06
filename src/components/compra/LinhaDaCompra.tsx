"use client";

import { useState } from "react";
import { Badge, Button, Icone } from "@/components/ui";
import { CLASSE_CONTROLE } from "@/components/ui/Campo";
import type { AlertaPreco } from "@/domain/precos";
import { SeloPreco } from "@/components/lista/SeloPreco";
import { foiNaoPego, quantidadeDoItem } from "@/domain/compra";
import { passoDaUnidade } from "@/domain/lista";
import type { ItemLista, Produto } from "@/domain/types";
import { centavosParaCampo, reaisParaCentavos } from "@/lib/dinheiro";
import { brl, numeroBR } from "@/lib/format";
import { UNIDADE_ROTULO } from "@/lib/rotulos";
import { cn } from "@/lib/cn";

type Props = {
  item: ItemLista;
  produto?: Produto;
  alerta?: AlertaPreco;
  aoPegar: () => void;
  /** "Não peguei": marca (ou desmarca, se já estava marcado) o item como não comprado. */
  aoEstado: (e: "nao_encontrado" | "adiado") => void;
  aoQuantidade: (q: number) => void;
  aoPreco: (centavos: number | undefined) => void;
  aoRemover: () => void;
};

export function LinhaDaCompra({ item, produto, alerta, aoPegar, aoEstado, aoQuantidade, aoPreco, aoRemover }: Props) {
  const nome = produto?.nome ?? item.nomeAvulso ?? "";
  const passo = produto ? passoDaUnidade(produto.unidade) : 1;
  const unidade = produto ? UNIDADE_ROTULO[produto.unidade] : "";
  const quantidade = quantidadeDoItem(item);
  const pego = item.status === "pego" || item.status === "extra";
  const naoPego = foiNaoPego(item);
  const [preco, setPreco] = useState(() => centavosParaCampo(item.precoCentavos));
  const [aberto, setAberto] = useState(false);

  const stepper = (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Quantidade de ${nome}`}>
      <Button variante="secundario" className="min-w-11 px-0" aria-label={`Diminuir ${nome}`} onClick={() => aoQuantidade(quantidade - passo)}>
        −
      </Button>
      <span className="numero min-w-16 text-center font-semibold">
        {numeroBR(quantidade)} {unidade}
      </span>
      <Button variante="secundario" className="min-w-11 px-0" aria-label={`Aumentar ${nome}`} onClick={() => aoQuantidade(quantidade + passo)}>
        +
      </Button>
    </div>
  );

  const campoPreco = (
    <input
      aria-label={`Preço unitário de ${nome} (opcional)`}
      inputMode="decimal"
      value={preco}
      placeholder="R$ 0,00"
      onChange={(e) => setPreco(e.target.value)}
      onBlur={() => aoPreco(reaisParaCentavos(preco))}
      className={cn(CLASSE_CONTROLE, "min-h-11 min-w-0 text-center")}
    />
  );

  // "Não peguei": linha mínima, em amarelo (aviso), no fim da lista. Tocar desfaz.
  if (naoPego) {
    return (
      <li className="rounded-lg border border-aviso/40 bg-aviso/10">
        <button
          type="button"
          aria-label={`Desfazer não peguei: ${nome}`}
          onClick={() => aoEstado(item.status === "adiado" ? "adiado" : "nao_encontrado")}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primario"
        >
          <Icone nome="erro" className="size-6 shrink-0 text-aviso" />
          <span className="min-w-0 flex-1 break-words font-medium">{nome}</span>
          <span className="shrink-0 text-sm text-aviso">Não peguei</span>
        </button>
      </li>
    );
  }

  // Pego: uma linha (✓ verde desfaz; o nome abre quantidade e preço).
  if (pego) {
    const ehExtra = item.status === "extra";
    return (
      <li className="rounded-lg border border-sucesso/40 bg-sucesso/10">
        <div className="flex min-h-11 items-center gap-1 pr-3">
          {ehExtra ? (
            <span className="grid size-11 shrink-0 place-items-center text-sucesso" aria-hidden="true">
              <Icone nome="ok" className="size-6" />
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Desfazer peguei: ${nome}`}
              onClick={aoPegar}
              className="grid size-11 shrink-0 place-items-center rounded-lg text-sucesso focus-visible:outline focus-visible:outline-2 focus-visible:outline-primario"
            >
              <Icone nome="ok" className="size-6" />
            </button>
          )}
          <button
            type="button"
            aria-expanded={aberto}
            aria-label={`${aberto ? "Recolher" : "Editar"} ${nome}`}
            onClick={() => setAberto((a) => !a)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primario"
          >
            <span className="min-w-0 flex-1 break-words font-medium line-through decoration-sucesso/70">{nome}</span>
            {ehExtra ? <Badge tom="info">Extra</Badge> : null}
            <span className="numero shrink-0 text-sm text-suave">
              {numeroBR(quantidade)} {unidade}
              {item.precoCentavos !== undefined ? ` · ${brl(item.precoCentavos)}` : ""}
            </span>
          </button>
        </div>
        {aberto ? (
          <div className="flex flex-col gap-3 border-t border-sucesso/30 p-3">
            {stepper}
            <div className="grid grid-cols-2 gap-2">
              {campoPreco}
              {ehExtra ? (
                <Button variante="secundario" aria-label={`Remover ${nome}`} onClick={aoRemover}>
                  Remover
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </li>
    );
  }

  // Pendente: nome + quantidade; uma linha com Peguei e Não peguei (o preço é opcional, ao tocar no item pego).
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-medium">{nome}</p>
          {item.urgente ? <Badge tom="erro">Urgente</Badge> : null}
          <SeloPreco alerta={alerta} />
        </div>
        {stepper}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button aria-label={`Peguei ${nome}`} onClick={aoPegar}>
          Peguei
        </Button>
        <Button variante="secundario" aria-label={`Não peguei ${nome}`} onClick={() => aoEstado("nao_encontrado")}>
          Não peguei
        </Button>
      </div>
    </li>
  );
}
