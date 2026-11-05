"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, useToast } from "@/components/ui";
import { guardarCopiaNoNavegador } from "@/components/ajustes/copiaNavegador";
import { DIAS_PARA_LEMBRAR_BACKUP, type LembreteBackup as Lembrete } from "@/domain/backup";

function texto(l: Lembrete): string {
  if (l.motivo === "nunca") return "Você ainda não guardou nenhuma cópia de segurança. Seus dados ficam só neste celular: se ele for perdido ou limpo, tudo se perde.";
  if (l.motivo === "dias") return `Faz ${l.dias} dias (o limite é ${DIAS_PARA_LEMBRAR_BACKUP}) que você guardou a última cópia de segurança.`;
  return `Você importou ${l.notas} notas desde a última cópia de segurança.`;
}

/** Cartão discreto do Início: lembra de guardar a cópia de segurança (regra em `domain/backup.ts`). */
export function LembreteBackup({ lembrete }: { lembrete: Lembrete }) {
  const { mostrar } = useToast();
  const [ocupado, setOcupado] = useState(false);

  async function guardar(): Promise<void> {
    setOcupado(true);
    try {
      const r = await guardarCopiaNoNavegador();
      if (r.via !== "cancelado") mostrar("Cópia de segurança feita.");
    } catch {
      mostrar("Não consegui guardar a cópia de segurança.", "erro");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Alert tipo="info" aria-label="Lembrete de cópia de segurança">
      <p>{texto(lembrete)}</p>
      <div className="mt-2 flex flex-col gap-2">
        <Button variante="secundario" disabled={ocupado} onClick={() => void guardar()}>
          Guardar cópia agora
        </Button>
        <Link href="/ajustes#backup" className="inline-flex min-h-11 items-center font-medium underline">
          Ver opções em Ajustes
        </Link>
      </div>
    </Alert>
  );
}
