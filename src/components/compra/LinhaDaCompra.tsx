"use client";

import { useState } from "react";
import { Badge, Button, Input } from "@/components/ui";
import type { AlertaPreco } from "@/domain/precos";
import { SeloPreco } from "@/components/lista/SeloPreco";
import { quantidadeDoItem } from "@/domain/compra";
import { passoDaUnidade } from "@/domain/lista";
import type { ItemLista, Produto } from "@/domain/types";
import { centavosParaCampo, reaisParaCentavos } from "@/lib/dinheiro";
import { numeroBR } from "@/lib/format";
import { UNIDADE_ROTULO } from "@/lib/rotulos";
import { cn } from "@/lib/cn";

type Props = {
  item: ItemLista;
  produto?: Produto;
  alerta?: AlertaPreco;
  aoPegar: () => void;
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
  const [preco, setPreco] = useState(() => centavosParaCampo(item.precoCentavos));

  return (
    <li className={cn("flex flex-col gap-3 rounded-lg border p-3", pego ? "border-primario/40 bg-primario/5" : "border-borda bg-superficie")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("break-words text-lg font-medium", pego && "line-through decoration-primario/60")}>{nome}</p>
          {item.status === "nao_encontrado" ? <Badge tom="aviso">Não encontrei: volta na próxima ida</Badge> : null}
          {item.status === "adiado" ? <Badge tom="aviso">Adiado</Badge> : null}
          {item.status === "extra" ? <Badge tom="info">Extra</Badge> : null}
          {item.urgente ? <Badge tom="erro">Urgente</Badge> : null}
          <SeloPreco alerta={alerta} />
        </div>
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Quantidade de ${nome}`}>
          <Button variante="secundario" className="min-w-11 px-0" aria-label={`Diminuir ${nome}`} onClick={() => aoQuantidade(quantidade - passo)}>
            −
          </Button>
          <span className="min-w-16 text-center font-semibold">
            {numeroBR(quantidade)} {unidade}
          </span>
          <Button variante="secundario" className="min-w-11 px-0" aria-label={`Aumentar ${nome}`} onClick={() => aoQuantidade(quantidade + passo)}>
            +
          </Button>
        </div>
      </div>

      {item.status !== "extra" ? (
        <Button tamanho="grande" variante={pego ? "secundario" : "primario"} aria-pressed={pego} onClick={aoPegar}>
          {pego ? "Peguei ✓ (desfazer)" : "Peguei"}
        </Button>
      ) : null}

      <div className="flex flex-col gap-2">
        <Input
          rotulo={`Preço unitário de ${nome} (opcional)`}
          inputMode="decimal"
          value={preco}
          placeholder="0,00"
          onChange={(e) => setPreco(e.target.value)}
          onBlur={() => aoPreco(reaisParaCentavos(preco))}
        />
        {item.status !== "extra" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variante="secundario" aria-label={`Não encontrei ${nome}`} onClick={() => aoEstado("nao_encontrado")}>
              Não encontrei
            </Button>
            <Button variante="secundario" aria-label={`Adiar ${nome}`} onClick={() => aoEstado("adiado")}>
              Adiar
            </Button>
          </div>
        ) : (
          <Button variante="secundario" aria-label={`Remover ${nome}`} onClick={aoRemover}>
            Remover
          </Button>
        )}
      </div>
    </li>
  );
}
