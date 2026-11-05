"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type TipoToast = "ok" | "erro";
type Item = { id: number; texto: string; tipo: TipoToast };
type Contexto = { mostrar: (texto: string, tipo?: TipoToast) => void };

const ToastContext = createContext<Contexto | null>(null);
const DURACAO_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<Item[]>([]);

  const mostrar = useCallback((texto: string, tipo: TipoToast = "ok") => {
    setItens((atual) => [...atual, { id: Date.now() + Math.random(), texto, tipo }]);
  }, []);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
        {itens.map((i) => (
          <ToastItem key={i.id} item={i} aoFechar={() => setItens((a) => a.filter((x) => x.id !== i.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ item, aoFechar }: { item: Item; aoFechar: () => void }) {
  useEffect(() => {
    const t = setTimeout(aoFechar, DURACAO_MS);
    return () => clearTimeout(t);
  }, [aoFechar]);
  return (
    <div
      role={item.tipo === "erro" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto max-w-md rounded-lg px-4 py-3 text-sm shadow-lg",
        item.tipo === "erro" ? "bg-erro text-erro-fg" : "bg-texto text-fundo",
      )}
    >
      {item.texto}
    </div>
  );
}

export function useToast(): Contexto {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  return ctx;
}
