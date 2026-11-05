import type { ReactNode } from "react";

export function Pagina({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-verde">{titulo}</h1>
      {children}
    </div>
  );
}
