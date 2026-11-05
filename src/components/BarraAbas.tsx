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
  "/conferencia": "M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1ZM8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16M9 14l2 2 4-4",
  "/catalogo": "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  "/precos": "M3 12V4h8l10 10-8 8L3 12ZM7.5 8.5h.01",
  "/painel": "M5 20V10M12 20V4M19 20v-7",
  "/gastos": "M3 17l6-6 4 4 8-8M15 7h6v6",
  "/mercados": "M3 9l1.5-5h15L21 9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8",
  "/ajustes": "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
};

function Icone({ nome, tamanho = 24 }: { nome: string; tamanho?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="shrink-0">
      <path d={ICONES[nome]} />
    </svg>
  );
}

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primario";

function Aba({ ativa, icone, children }: { ativa: boolean; icone: string; children: string }) {
  return (
    <>
      <Icone nome={icone} />
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
    <>
      {/* escurece o conteúdo atrás da folha; tocar nele fecha o menu */}
      {maisAberto ? <div aria-hidden="true" onClick={() => setMaisAberto(false)} className="fixed inset-0 z-30 bg-black/50" /> : null}
      <nav
        ref={raiz}
        aria-label="Principal"
        className="fixed bottom-0 left-1/2 z-40 w-full max-w-coluna -translate-x-1/2 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] sm:border-x"
      >
        {maisAberto ? (
          <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain rounded-t-2xl border-b border-borda bg-superficie px-3 pb-3 pt-2">
            <div aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-borda-forte" />
            <p className="mb-2 px-1 font-titulo text-sm">Mais telas</p>
            <ul id="menu-mais" aria-label="Mais telas" className="grid grid-cols-2 gap-2">
              {noMais.map((r) => {
                const ativa = rotaAtiva(caminho, r.href);
                return (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      aria-current={ativa ? "page" : undefined}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-xl border px-3 text-base leading-tight",
                        FOCO,
                        ativa ? "border-primario bg-primario/10 font-semibold text-primario" : "border-borda text-texto",
                      )}
                    >
                      <Icone nome={r.href} tamanho={22} />
                      {r.rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <ul className="flex">
          {ROTAS.filter((r) => r.naBarra).map((r) => {
            const ativa = rotaAtiva(caminho, r.href);
            const destaque = ativa && !maisAberto; // com a folha aberta, só "Mais" fica em destaque
            return (
              <li key={r.href} className="flex-1">
                <Link href={r.href} aria-current={ativa ? "page" : undefined} className={cn(CLASSE_ABA, destaque ? "text-primario" : "text-suave")}>
                  <Aba ativa={destaque} icone={r.href}>
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
    </>
  );
}
