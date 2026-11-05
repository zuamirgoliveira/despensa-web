import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = { titulo: ReactNode; children: ReactNode; aberto?: boolean; className?: string };

/** Acordeão nativo (`<details>`): acessível por teclado e leitor de tela sem JavaScript. */
export function Details({ titulo, children, aberto, className }: Props) {
  return (
    <details open={aberto} className={cn("rounded-lg border border-borda bg-white", className)}>
      <summary className="min-h-11 cursor-pointer px-3 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-verde">
        {titulo}
      </summary>
      <div className="border-t border-borda px-3 py-3">{children}</div>
    </details>
  );
}
