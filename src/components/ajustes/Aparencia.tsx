"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { lerPreferencia, salvarPreferencia, type PreferenciaTema } from "@/lib/tema";

const OPCOES: { valor: PreferenciaTema; rotulo: string }[] = [
  { valor: "sistema", rotulo: "Sistema" },
  { valor: "claro", rotulo: "Claro" },
  { valor: "escuro", rotulo: "Escuro" },
];

/** Escolha do tema (Claro, Escuro ou Sistema), numa linha. Fica só neste aparelho (localStorage), fora do backup. */
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
        <div className="grid grid-cols-3 gap-2">
          {OPCOES.map((o) => (
            <label
              key={o.valor}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primario",
                pref === o.valor ? "border-primario bg-primario/10" : "border-borda-forte",
              )}
            >
              <input
                type="radio"
                name="tema"
                value={o.valor}
                checked={pref === o.valor}
                onChange={() => escolher(o.valor)}
                className="h-5 w-5 accent-primario"
              />
              {o.rotulo}
            </label>
          ))}
        </div>
        <p className="text-sm text-suave">Sistema segue o tema do aparelho. A escolha vale só neste aparelho.</p>
      </fieldset>
    </Card>
  );
}
