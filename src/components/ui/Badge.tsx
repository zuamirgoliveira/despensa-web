import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tom = "neutro" | "verde" | "aviso" | "erro";

const TONS: Record<Tom, string> = {
  neutro: "bg-fundo text-texto border-borda",
  verde: "bg-verde/10 text-verde border-verde/30",
  aviso: "bg-aviso/10 text-aviso border-aviso/30",
  erro: "bg-erro/10 text-erro border-erro/30",
};

export function Badge({ tom = "neutro", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tom?: Tom }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", TONS[tom], className)}
      {...props}
    />
  );
}
