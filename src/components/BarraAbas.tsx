"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ROTAS, rotaAtiva } from "@/lib/rotas";

const CLASSE_ABA =
  "flex min-h-14 w-full items-center justify-center px-2 text-sm font-medium " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-verde";

export function BarraAbas() {
  const caminho = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);
  const raiz = useRef<HTMLElement>(null);
  const noMais = ROTAS.filter((r) => r.noMais);
  const maisAtivo = noMais.some((r) => rotaAtiva(caminho, r.href));

  // fecha ao trocar de tela, com Esc ou ao tocar fora
  useEffect(() => {
    queueMicrotask(() => setMaisAberto(false));
  }, [caminho]);
  useEffect(() => {
    if (!maisAberto) return;
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMaisAberto(false);
    };
    const fora = (e: MouseEvent): void => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setMaisAberto(false);
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", fora);
    return () => {
      document.removeEventListener("keydown", esc);
      document.removeEventListener("mousedown", fora);
    };
  }, [maisAberto]);

  return (
    <nav
      ref={raiz}
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-white pb-[env(safe-area-inset-bottom)]"
    >
      {maisAberto ? (
        <ul id="menu-mais" aria-label="Mais telas" className="mx-auto flex max-w-2xl flex-col border-b border-borda bg-white">
          {noMais.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                aria-current={rotaAtiva(caminho, r.href) ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-verde",
                  rotaAtiva(caminho, r.href) ? "font-semibold text-verde" : "text-texto",
                )}
              >
                {r.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mx-auto flex max-w-2xl">
        {ROTAS.filter((r) => r.naBarra).map((r) => {
          const ativa = rotaAtiva(caminho, r.href);
          return (
            <li key={r.href} className="flex-1">
              <Link href={r.href} aria-current={ativa ? "page" : undefined} className={cn(CLASSE_ABA, ativa ? "text-verde" : "text-texto/70")}>
                {r.rotulo}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            type="button"
            aria-expanded={maisAberto}
            aria-controls="menu-mais"
            onClick={() => setMaisAberto((a) => !a)}
            className={cn(CLASSE_ABA, maisAtivo || maisAberto ? "text-verde" : "text-texto/70")}
          >
            Mais
          </button>
        </li>
      </ul>
    </nav>
  );
}
