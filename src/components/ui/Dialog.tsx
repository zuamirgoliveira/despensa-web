"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";

type Props = {
  aberto: boolean;
  titulo: string;
  children?: ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  perigo?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
};

/** Diálogo de confirmação próprio (nunca usar window.confirm). Usa o <dialog> nativo. */
export function Dialog({
  aberto,
  titulo,
  children,
  rotuloConfirmar = "Confirmar",
  rotuloCancelar = "Cancelar",
  perigo,
  aoConfirmar,
  aoCancelar,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      onCancel={(e) => {
        e.preventDefault();
        aoCancelar();
      }}
      className="w-[min(92vw,26rem)] rounded-xl border border-borda bg-superficie p-0 text-texto backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-4">
        <h2 id={tituloId} className="text-sm">
          {titulo}
        </h2>
        {children ? <div className="text-sm">{children}</div> : null}
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={aoCancelar}>
            {rotuloCancelar}
          </Button>
          <Button variante={perigo ? "perigo" : "primario"} onClick={aoConfirmar}>
            {rotuloConfirmar}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
