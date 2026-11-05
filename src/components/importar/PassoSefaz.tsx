"use client";

import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { SEFAZ_CONSULTA } from "@/domain/nfce/sefaz";
import type { ChaveValida } from "./PassoChave";

export function PassoSefaz({ chave }: { chave: ChaveValida | null }) {
  const [msg, setMsg] = useState<{ texto: string; tipo: "ok" | "erro" } | null>(null);
  const url = chave ? SEFAZ_CONSULTA[chave.uf] : undefined;

  async function abrir(): Promise<void> {
    if (!chave || !url) return;
    let copiou = true;
    try {
      await navigator.clipboard.writeText(chave.chave);
    } catch {
      copiou = false;
    }
    window.open(url, "_blank", "noopener");
    setMsg(
      copiou
        ? { texto: "Chave copiada. Na SEFAZ: cole no campo, marque o captcha e toque em Consultar. Depois copie o texto e volte aqui.", tipo: "ok" }
        : { texto: "Não consegui copiar sozinho. Selecione a chave acima, copie e cole no site da SEFAZ.", tipo: "erro" },
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">2. Consultar na SEFAZ</h2>
      <p className="text-sm text-texto/70">
        O site da SEFAZ pede um captcha: quem resolve é você. O app só copia a chave e abre a página.
      </p>
      <Button disabled={!url} onClick={() => void abrir()}>
        Copiar chave e abrir SEFAZ
      </Button>
      {chave && !url ? (
        <Alert tipo="erro">
          Consulta ainda só configurada para PE. Para {chave.uf}, abra o site da SEFAZ do estado e cole o texto no passo 3.
        </Alert>
      ) : null}
      {msg ? <Alert tipo={msg.tipo === "ok" ? "info" : "erro"}>{msg.texto}</Alert> : null}
    </Card>
  );
}
