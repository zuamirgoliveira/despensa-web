"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { ComparacaoMercados } from "./ComparacaoMercados";
import { ListaPrecos } from "./ListaPrecos";

export function PrecosAbas() {
  const [aba, setAba] = useState<"historico" | "comparar">("historico");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Visão dos preços">
        <Button variante={aba === "historico" ? "primario" : "secundario"} aria-pressed={aba === "historico"} onClick={() => setAba("historico")}>
          Histórico
        </Button>
        <Button variante={aba === "comparar" ? "primario" : "secundario"} aria-pressed={aba === "comparar"} onClick={() => setAba("comparar")}>
          Comparar
        </Button>
      </div>
      {aba === "historico" ? <ListaPrecos /> : <ComparacaoMercados />}
    </div>
  );
}
