import type { ReactNode } from "react";

export function Pagina({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg text-texto">{titulo}</h1>
      {children}
    </div>
  );
}
