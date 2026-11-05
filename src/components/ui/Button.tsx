import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variante = "primario" | "secundario" | "perigo";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-verde text-white hover:bg-verde/90",
  secundario: "border border-borda bg-white text-texto hover:bg-fundo",
  perigo: "bg-erro text-white hover:bg-erro/90",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante };

export function Button({ variante = "primario", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-medium",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verde",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTES[variante],
        className,
      )}
      {...props}
    />
  );
}
