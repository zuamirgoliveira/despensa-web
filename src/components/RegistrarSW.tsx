"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/** Registra o service worker (produção ou localhost) e avisa, sem bloquear, quando há versão nova. */
export function RegistrarSW() {
  const [novaVersao, setNovaVersao] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const local = ["localhost", "127.0.0.1"].includes(location.hostname);
    if (process.env.NODE_ENV !== "production" && !local) return;

    const tinhaControlador = Boolean(navigator.serviceWorker.controller);
    const aoTrocar = (): void => {
      if (tinhaControlador) setNovaVersao(true);
    };
    navigator.serviceWorker.addEventListener("controllerchange", aoTrocar);
    // O parâmetro muda a cada build: força o navegador a instalar o SW novo.
    navigator.serviceWorker.register(`/sw.js?v=${BUILD_ID}`, { scope: "/" }).catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", aoTrocar);
  }, []);

  if (!novaVersao) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 top-0 z-50 flex w-full max-w-coluna -translate-x-1/2 items-center justify-between gap-2 bg-texto px-4 py-2 text-sm text-fundo"
    >
      <span>Nova versão disponível.</span>
      <Button variante="secundario" className="min-h-11" onClick={() => location.reload()}>
        Atualizar
      </Button>
    </div>
  );
}
