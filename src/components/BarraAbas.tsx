"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ROTAS, rotaAtiva } from "@/lib/rotas";

/** Ícones (traço de 24×24) da barra inferior. Decorativos: o rótulo em texto é o nome acessível. */
const ICONES: Record<string, string> = {
  "/": "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  "/importar": "M12 3v12M7 10l5 5 5-5M4 20h16",
  "/lista": "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  "/compras": "M5 8h14l-1 12H6L5 8ZM9 8a3 3 0 0 1 6 0",
  mais: "M5 12h.01M12 12h.01M19 12h.01",
};

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primario";

function Aba({ ativa, icone, children }: { ativa: boolean; icone: string; children: string }) {
  return (
    <>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={ICONES[icone]} />
      </svg>
      <span className="text-xs font-medium">{children}</span>
      {/* detalhe de identidade: barra curta dourada sob a aba ativa */}
      <span aria-hidden="true" className={cn("absolute inset-x-1/3 top-0 h-0.5 rounded-b bg-destaque", ativa ? "opacity-100" : "opacity-0")} />
    </>
  );
}

const CLASSE_ABA = cn("relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1", FOCO);

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
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-coluna -translate-x-1/2 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] sm:border-x"
    >
      {maisAberto ? (
        <ul id="menu-mais" aria-label="Mais telas" className="flex flex-col border-b border-borda bg-superficie py-1">
          {noMais.map((r) => {
            const ativa = rotaAtiva(caminho, r.href);
            return (
              <li key={r.href}>
                <Link
                  href={r.href}
                  aria-current={ativa ? "page" : undefined}
                  className={cn("flex min-h-12 items-center gap-3 px-4 text-base", FOCO, ativa ? "font-semibold text-primario" : "text-texto")}
                >
                  <span aria-hidden="true" className={cn("h-4 w-0.5 rounded bg-destaque", ativa ? "opacity-100" : "opacity-0")} />
                  {r.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      <ul className="flex">
        {ROTAS.filter((r) => r.naBarra).map((r) => {
          const ativa = rotaAtiva(caminho, r.href);
          return (
            <li key={r.href} className="flex-1">
              <Link href={r.href} aria-current={ativa ? "page" : undefined} className={cn(CLASSE_ABA, ativa ? "text-primario" : "text-suave")}>
                <Aba ativa={ativa} icone={r.href}>
                  {r.rotulo}
                </Aba>
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
            className={cn(CLASSE_ABA, maisAtivo || maisAberto ? "text-primario" : "text-suave")}
          >
            <Aba ativa={maisAtivo || maisAberto} icone="mais">
              Mais
            </Aba>
          </button>
        </li>
      </ul>
    </nav>
  );
}
