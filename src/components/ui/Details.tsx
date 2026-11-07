import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  titulo: ReactNode;
  children: ReactNode;
  aberto?: boolean;
  /** Avisa quando a pessoa abre ou fecha. Com `aberto`, deixa o pai controlar (ex.: fechar ao salvar). */
  aoAlternar?: (aberto: boolean) => void;
  className?: string;
  /** Use quando o acordeão já está dentro de um Card (evita borda dupla). */
  semBorda?: boolean;
};

/** Acordeão nativo (`<details>`): acessível por teclado e leitor de tela sem JavaScript. */
export function Details({ titulo, children, aberto, aoAlternar, className, semBorda }: Props) {
  return (
    <details
      open={aberto}
      onToggle={aoAlternar ? (e) => aoAlternar(e.currentTarget.open) : undefined}
      className={cn("group", !semBorda && "rounded-lg border border-borda bg-superficie", className)}
    >
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 font-medium [&::-webkit-details-marker]:hidden",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario",
          semBorda ? "px-0" : "px-3",
        )}
      >
        <span className="min-w-0 flex-1">{titulo}</span>
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
          className="shrink-0 text-suave transition-transform group-open:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className={cn("border-t border-borda py-3", semBorda ? "px-0" : "px-3")}>{children}</div>
    </details>
  );
}
