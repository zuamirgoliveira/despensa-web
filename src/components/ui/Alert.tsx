import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomeIcone } from "./Icone";

type Tipo = "aviso" | "erro" | "info" | "sucesso";

const TIPOS: Record<Tipo, { classe: string; icone: NomeIcone }> = {
  aviso: { classe: "border-aviso/40 bg-aviso/10 text-aviso", icone: "aviso" },
  erro: { classe: "border-erro/40 bg-erro/10 text-erro", icone: "erro" },
  info: { classe: "border-primario/40 bg-primario/10 text-primario", icone: "info" },
  sucesso: { classe: "border-sucesso/40 bg-sucesso/10 text-sucesso", icone: "ok" },
};

/** `erro` usa role="alert"; os demais, role="status". O ícone garante que a cor não seja o único sinal. */
export function Alert({ tipo = "aviso", className, children, ...props }: HTMLAttributes<HTMLDivElement> & { tipo?: Tipo }) {
  const t = TIPOS[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", t.classe, className)} {...props}>
      <Icone nome={t.icone} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
