"use client";

import { useEffect } from "react";
import { pedirPersistencia } from "@/lib/armazenamento";

/** Pede ao navegador, uma vez por abertura, para não despejar os dados do app por falta de espaço. */
export function ProtegerArmazenamento() {
  useEffect(() => {
    void pedirPersistencia();
  }, []);
  return null;
}
