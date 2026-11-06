"use client";

import { useState } from "react";
import { Alert, Button, Card, Details, Input, Select } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { criarItemManual, ItemJaExisteError } from "@/data/despensa";
import type { Categoria, Produto } from "@/domain/types";
import { lerQuantidade } from "@/lib/despensaVisao";
import { CATEGORIA_ROTULO, UNIDADE_ROTULO } from "@/lib/rotulos";
import { CATEGORIAS, UNIDADES_PRODUTO } from "@/schemas";

export function AdicionarItem({ aoCriar }: { aoCriar: (nome: string) => void }) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("mercearia");
  const [unidade, setUnidade] = useState<Produto["unidade"]>("un");
  const [padrao, setPadrao] = useState("");
  const [atual, setAtual] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe o nome do item.");
    if ((padrao.trim() && lerQuantidade(padrao) === undefined) || (atual.trim() && lerQuantidade(atual) === undefined)) return setErro("Digite quantidades válidas.");
    try {
      await criarItemManual(await criarRepositorios(), { nome, categoria, unidade, padrao: lerQuantidade(padrao), atual: lerQuantidade(atual) });
      aoCriar(nome.trim());
      setNome("");
      setPadrao("");
      setAtual("");
      setErro(null);
    } catch (x) {
      setErro(x instanceof ItemJaExisteError ? x.message : "Não consegui adicionar o item.");
    }
  }

  return (
    <Card className="p-3">
      <Details semBorda titulo="Adicionar item">
        <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3" noValidate>
          <Input rotulo="Nome do item" value={nome} onChange={(e) => setNome(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input rotulo="Quantidade padrão (opcional)" inputMode="decimal" value={padrao} onChange={(e) => setPadrao(e.target.value)} />
            <Input rotulo="Quantidade atual (opcional)" inputMode="decimal" value={atual} onChange={(e) => setAtual(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select rotulo="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value as Produto["unidade"])}>
              {UNIDADES_PRODUTO.map((u) => (
                <option key={u} value={u}>
                  {UNIDADE_ROTULO[u]}
                </option>
              ))}
            </Select>
            <Select rotulo="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_ROTULO[c]}
                </option>
              ))}
            </Select>
          </div>
          {erro ? <Alert tipo="erro">{erro}</Alert> : null}
          <Button type="submit">Adicionar à despensa</Button>
        </form>
      </Details>
    </Card>
  );
}
