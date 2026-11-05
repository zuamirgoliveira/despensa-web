"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { lerPreferencia, salvarPreferencia, type PreferenciaTema } from "@/lib/tema";

const OPCOES: { valor: PreferenciaTema; rotulo: string; ajuda: string }[] = [
  { valor: "sistema", rotulo: "Sistema", ajuda: "Segue o tema do aparelho" },
  { valor: "claro", rotulo: "Claro", ajuda: "Fundo claro" },
  { valor: "escuro", rotulo: "Escuro", ajuda: "Fundo azul-marinho" },
];

/** Escolha do tema (Claro, Escuro ou Sistema). Fica só neste aparelho (localStorage), fora do backup. */
export function Aparencia() {
  const [pref, setPref] = useState<PreferenciaTema>("sistema");

  useEffect(() => {
    queueMicrotask(() => setPref(lerPreferencia(window.localStorage)));
  }, []);

  const escolher = (nova: PreferenciaTema): void => {
    setPref(nova);
    salvarPreferencia(nova, document, window.localStorage);
  };

  return (
    <Card>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-titulo text-sm">Aparência</legend>
        <p className="text-sm text-suave">A escolha vale só neste aparelho.</p>
        <div className="flex flex-col gap-2">
          {OPCOES.map((o) => (
            <label
              key={o.valor}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primario",
                pref === o.valor ? "border-primario bg-primario/10" : "border-borda-forte",
              )}
            >
              <input type="radio" name="tema" value={o.valor} checked={pref === o.valor} onChange={() => escolher(o.valor)} className="h-5 w-5 accent-primario" />
              <span className="flex flex-col">
                <span className="font-medium">{o.rotulo}</span>
                <span className="text-sm text-suave">{o.ajuda}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}
