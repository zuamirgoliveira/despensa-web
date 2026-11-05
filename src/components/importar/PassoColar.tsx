"use client";

import { useState } from "react";
import { Alert, Button, Card, Textarea } from "@/components/ui";

type Props = { texto: string; aoMudarTexto: (t: string) => void; aoLer: () => void; mensagem: { texto: string; tipo: "ok" | "erro" } | null };

export function PassoColar({ texto, aoMudarTexto, aoLer, mensagem }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);

  async function colar(): Promise<void> {
    try {
      const t = await navigator.clipboard.readText();
      aoMudarTexto(t);
      setAviso(null);
      aoLer();
    } catch {
      setAviso("O navegador não deixou colar sozinho. Toque e segure na caixa e escolha Colar.");
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">3. Colar o texto da nota</h2>
      <Textarea
        rotulo="Texto copiado da página da SEFAZ"
        value={texto}
        onChange={(e) => aoMudarTexto(e.target.value)}
        rows={5}
        ajuda="No Android, também dá para usar Compartilhar na página da SEFAZ e escolher Despensa."
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variante="secundario" onClick={() => void colar()}>
          Colar da área de transferência
        </Button>
        <Button onClick={aoLer}>Ler nota</Button>
      </div>
      {aviso ? <Alert tipo="erro">{aviso}</Alert> : null}
      {mensagem ? <Alert tipo={mensagem.tipo === "ok" ? "info" : "erro"}>{mensagem.texto}</Alert> : null}
    </Card>
  );
}
