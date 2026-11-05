import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tipo = "aviso" | "erro" | "info";

const TIPOS: Record<Tipo, string> = {
  aviso: "border-aviso/40 bg-aviso/10 text-aviso",
  erro: "border-erro/40 bg-erro/10 text-erro",
  info: "border-verde/40 bg-verde/10 text-verde",
};

/** `erro` usa role="alert"; os demais, role="status". */
export function Alert({ tipo = "aviso", className, ...props }: HTMLAttributes<HTMLDivElement> & { tipo?: Tipo }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={cn("rounded-lg border px-3 py-2 text-sm", TIPOS[tipo], className)}
      {...props}
    />
  );
}
