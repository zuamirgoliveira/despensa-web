import { cn } from "@/lib/cn";

type Props = { valor: number; maximo?: number; rotulo: string; className?: string };

export function Progress({ valor, maximo = 100, rotulo, className }: Props) {
  const pct = maximo > 0 ? Math.min(100, Math.max(0, (valor / maximo) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={maximo}
      aria-valuenow={Math.min(valor, maximo)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-borda", className)}
    >
      <div className="h-full bg-verde transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
