import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variante = "primario" | "secundario" | "perigo";
type Tamanho = "normal" | "grande";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-primario text-primario-fg hover:bg-primario/90",
  secundario: "border border-borda-forte bg-superficie text-texto hover:bg-fundo",
  perigo: "bg-erro text-erro-fg hover:bg-erro/90",
};

const TAMANHOS: Record<Tamanho, string> = {
  normal: "min-h-11 text-base",
  /** Modo compra e telas de uso com uma mão: alvo de 56 px. */
  grande: "min-h-14 text-lg",
};

/** Classes de botão, para links (`<Link>`) que precisam parecer botão. */
export function classesBotao(variante: Variante = "primario", tamanho: Tamanho = "normal", className?: string): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-center font-medium",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario",
    "disabled:cursor-not-allowed disabled:opacity-50",
    TAMANHOS[tamanho],
    VARIANTES[variante],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: Tamanho };

export function Button({ variante = "primario", tamanho = "normal", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={classesBotao(variante, tamanho, className)} {...props} />;
}

/** Link com aparência de botão (navegação). */
export function LinkBotao({
  variante = "primario",
  tamanho = "normal",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; tamanho?: Tamanho }) {
  return <Link className={classesBotao(variante, tamanho, className)} {...props} />;
}
