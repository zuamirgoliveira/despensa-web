import type { ReactNode } from "react";

type Props = { titulo: string; children?: ReactNode; acao?: ReactNode };

export function EmptyState({ titulo, children, acao }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-borda p-6 text-center">
      <p className="text-lg font-medium">{titulo}</p>
      {children ? <div className="text-sm text-texto/70">{children}</div> : null}
      {acao}
    </div>
  );
}
