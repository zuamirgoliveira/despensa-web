"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, Details, Dialog, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { mesclarProdutos } from "@/data/catalogo";
import { sugerirMesclagens, type SugestaoMesclagem } from "@/domain/normalizacao";
import type { Compra, Produto } from "@/domain/types";

const MOTIVO: Record<SugestaoMesclagem["motivo"], string> = {
  igual: "Mesmo produto escrito de outro jeito.",
  tamanho: "Mesmas palavras, com tamanho diferente ou sem tamanho.",
  parecido: "Nomes parecidos. Confira antes de mesclar.",
};

/** Pares do catálogo que provavelmente são o mesmo produto. Só mescla com a confirmação do usuário. */
export function DuplicadosCatalogo({ produtos, compras }: { produtos: readonly Produto[]; compras: readonly Compra[] }) {
  const { mostrar } = useToast();
  const [pedido, setPedido] = useState<{ manter: Produto; unir: Produto } | null>(null);
  const sugestoes = useMemo(() => sugerirMesclagens(produtos, compras), [produtos, compras]);

  if (sugestoes.length === 0) return null;

  async function confirmar(): Promise<void> {
    if (!pedido) return;
    try {
      await mesclarProdutos(await criarRepositorios(), pedido.unir.id, pedido.manter.id);
      mostrar("Produtos mesclados.");
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Não consegui mesclar.", "erro");
    }
    setPedido(null);
  }

  return (
    <Card>
      <Details
        semBorda
        aberto={sugestoes.some((s) => s.motivo === "igual")}
        titulo={<h2 className="text-sm">Possíveis duplicados ({sugestoes.length})</h2>}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-suave">
            O app compara os nomes sem diferença de maiúsculas, acento, ordem das palavras e jeito de escrever o tamanho. Nada é mesclado sem você confirmar.
          </p>
          <ul className="flex flex-col gap-3">
            {sugestoes.map((s) => (
              <li key={`${s.origem.id}-${s.destino.id}`} className="flex flex-col gap-2 rounded-lg border border-borda p-3">
                <p className="text-sm">
                  <strong>{s.destino.nome}</strong> e <strong>{s.origem.nome}</strong>
                </p>
                <p className="text-xs text-suave">{MOTIVO[s.motivo]}</p>
                <div className="flex flex-col gap-2">
                  <Button variante="secundario" onClick={() => setPedido({ manter: s.destino, unir: s.origem })}>
                    Manter “{s.destino.nome}”
                  </Button>
                  <Button variante="secundario" onClick={() => setPedido({ manter: s.origem, unir: s.destino })}>
                    Manter “{s.origem.nome}”
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Details>

      <Dialog
        aberto={pedido !== null}
        titulo="Mesclar produtos?"
        rotuloConfirmar="Mesclar"
        perigo
        aoConfirmar={() => void confirmar()}
        aoCancelar={() => setPedido(null)}
      >
        {pedido ? (
          <div className="flex flex-col gap-2">
            <p>
              “{pedido.unir.nome}” será unido a “{pedido.manter.nome}”: compras, preços, apelidos e estoque passam para “{pedido.manter.nome}”, e “{pedido.unir.nome}” deixa de existir.
            </p>
            <Alert tipo="aviso">Não dá para desfazer. Para ter segurança, exporte um backup antes (Ajustes → Backup).</Alert>
          </div>
        ) : null}
      </Dialog>
    </Card>
  );
}
