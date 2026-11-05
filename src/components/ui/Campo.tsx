import { useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  rotulo: string;
  erro?: string;
  ajuda?: string;
  className?: string;
  /** Recebe o id e os atributos de acessibilidade que o controle deve usar. */
  children: (a: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactElement;
};

/** Rótulo + controle + ajuda/erro, ligados por id. Base de Input, Textarea e Select. */
export function Campo({ rotulo, erro, ajuda, className, children }: Props): ReactNode {
  const id = useId();
  const descId = erro || ajuda ? `${id}-desc` : undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      {children({ id, "aria-invalid": Boolean(erro), "aria-describedby": descId })}
      {erro ? (
        <p id={descId} role="alert" className="text-sm text-erro">
          {erro}
        </p>
      ) : ajuda ? (
        <p id={descId} className="text-sm text-texto/70">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

export const CLASSE_CONTROLE =
  "min-h-11 w-full rounded-lg border border-borda bg-white px-3 py-2 text-base text-texto " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-verde " +
  "aria-[invalid=true]:border-erro disabled:opacity-60";
