"use client";

import { Badge, Button } from "@/components/ui";
import { passoDaUnidade, type MotivoItem } from "@/domain/lista";
import type { ItemLista, Produto } from "@/domain/types";
import { numeroBR } from "@/lib/format";
import { UNIDADE_ROTULO } from "@/lib/rotulos";

const MOTIVO: Record<MotivoItem | "manual", string> = {
  acabou: "Acabou",
  cobertura: "Vai faltar antes da próxima ida",
  puxado: "Puxado da feira mensal",
  manual: "Adicionado por você",
};

type Props = {
  item: ItemLista;
  produto?: Produto;
  aoAlterar: (quantidade: number) => void;
  aoRemover: () => void;
};

export function ItemDaLista({ item, produto, aoAlterar, aoRemover }: Props) {
  const nome = produto?.nome ?? item.nomeAvulso ?? "";
  const passo = produto ? passoDaUnidade(produto.unidade) : 1;
  const unidade = produto ? UNIDADE_ROTULO[produto.unidade] : "";
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-borda bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{nome}</p>
          <p className="text-xs text-texto/70">{item.motivo ? MOTIVO[item.motivo] : ""}</p>
        </div>
        {item.urgente ? <Badge tom="erro">Urgente</Badge> : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variante="secundario"
            className="min-w-11 px-0"
            aria-label={`Diminuir ${nome}`}
            disabled={item.quantidadeSugerida <= 0}
            onClick={() => aoAlterar(item.quantidadeSugerida - passo)}
          >
            −
          </Button>
          <span className="min-w-20 text-center font-semibold" aria-live="polite">
            {numeroBR(item.quantidadeSugerida)} {unidade}
          </span>
          <Button variante="secundario" className="min-w-11 px-0" aria-label={`Aumentar ${nome}`} onClick={() => aoAlterar(item.quantidadeSugerida + passo)}>
            +
          </Button>
        </div>
        <Button variante="secundario" aria-label={`Remover ${nome}`} onClick={aoRemover}>
          Remover
        </Button>
      </div>
    </li>
  );
}
