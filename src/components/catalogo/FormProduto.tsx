"use client";

import { useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { CATEGORIAS, UNIDADES_PRODUTO } from "@/schemas";
import type { Mercado, Produto } from "@/domain/types";
import { validarProduto, valoresDoProduto, type CampoProduto, type ValoresProduto } from "@/lib/formProduto";
import { CATEGORIA_ROTULO, UNIDADE_ROTULO } from "@/lib/rotulos";

type Props = {
  produto: Produto;
  mercados: readonly Mercado[];
  aoSalvar: (novo: Produto) => Promise<void>;
  /** Devolve o padrão ao cálculo automático (média das compras). Só aparece quando o padrão foi fixado à mão. */
  aoLiberarPadrao?: () => Promise<void>;
};

export function FormProduto({ produto, mercados, aoSalvar, aoLiberarPadrao }: Props) {
  const [v, setV] = useState<ValoresProduto>(() => valoresDoProduto(produto));
  const [erros, setErros] = useState<Partial<Record<CampoProduto, string>>>({});
  const [salvando, setSalvando] = useState(false);
  const muda = (campo: CampoProduto) => (e: { target: { value: string } }) => setV((a) => ({ ...a, [campo]: e.target.value }));

  async function enviar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const r = validarProduto(produto, v);
    if (!r.ok) return setErros(r.erros);
    setErros({});
    setSalvando(true);
    try {
      await aoSalvar(r.produto);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3" noValidate>
      <Input rotulo="Nome" value={v.nome} onChange={muda("nome")} erro={erros.nome} />
      <div className="grid grid-cols-2 gap-3">
        <Select rotulo="Categoria" value={v.categoria} onChange={muda("categoria")} erro={erros.categoria}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_ROTULO[c]}
            </option>
          ))}
        </Select>
        <Select rotulo="Unidade de compra" value={v.unidade} onChange={muda("unidade")} erro={erros.unidade}>
          {UNIDADES_PRODUTO.map((u) => (
            <option key={u} value={u}>
              {UNIDADE_ROTULO[u]}
            </option>
          ))}
        </Select>
      </div>
      <Input
        rotulo={`Quantidade padrão (${UNIDADE_ROTULO[v.unidade as Produto["unidade"]] ?? "quantidade"})`}
        inputMode="decimal"
        value={v.meta}
        onChange={muda("meta")}
        erro={erros.meta}
        ajuda={produto.metaManual ? "Padrão fixado por você: não muda mais com as compras." : "Calculado pela média das compras."}
      />
      {produto.metaManual && aoLiberarPadrao ? (
        <Button type="button" variante="secundario" onClick={() => void aoLiberarPadrao()}>
          Voltar ao cálculo automático
        </Button>
      ) : null}
      <Input rotulo="Local na casa" value={v.localCasa} onChange={muda("localCasa")} erro={erros.localCasa} placeholder="geladeira, armário…" />
      <Select rotulo="Mercado preferido" value={v.mercadoPreferidoId} onChange={muda("mercadoPreferidoId")} erro={erros.mercadoPreferidoId}>
        <option value="">Nenhum</option>
        {mercados.map((m) => (
          <option key={m.id} value={m.id}>
            {m.apelido || m.nome}
          </option>
        ))}
      </Select>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-5" checked={v.recorrente} onChange={(e) => setV((a) => ({ ...a, recorrente: e.target.checked }))} />
        Repor sempre (entra na lista quando faltar)
      </label>
      {Object.keys(erros).length ? <Alert tipo="erro">Corrija os campos destacados.</Alert> : null}
      <Button type="submit" disabled={salvando}>
        Salvar produto
      </Button>
    </form>
  );
}
