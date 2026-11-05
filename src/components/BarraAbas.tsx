"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ROTAS } from "@/lib/rotas";

export function BarraAbas() {
  const caminho = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {ROTAS.filter((r) => r.naBarra).map((r) => {
          const ativa = caminho === r.href || caminho.startsWith(`${r.href}/`);
          return (
            <li key={r.href} className="flex-1">
              <Link
                href={r.href}
                aria-current={ativa ? "page" : undefined}
                className={cn(
                  "flex min-h-14 items-center justify-center px-2 text-sm font-medium",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-verde",
                  ativa ? "text-verde" : "text-texto/70",
                )}
              >
                {r.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
