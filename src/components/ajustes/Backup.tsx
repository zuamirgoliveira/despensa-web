"use client";

import { useRef, useState } from "react";
import { Alert, Button, Card, useToast } from "@/components/ui";
import { BackupInvalidoError, criarRepositorios, exportar, importar } from "@/data";
import { hojeRecife } from "@/lib/datas";

const ROTULOS: Record<string, string> = {
  compras: "compras",
  mercados: "mercados",
  produtos: "produtos",
  apelidos: "apelidos",
};

export function Backup() {
  const { mostrar } = useToast();
  const arquivo = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<string | null>(null);

  async function baixar(): Promise<void> {
    const dados = await exportar(await criarRepositorios());
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `despensa-backup-${hojeRecife()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    mostrar("Backup exportado.");
  }

  async function restaurar(f: File | undefined): Promise<void> {
    if (!f) return;
    setErro(null);
    setResumo(null);
    try {
      const r = await importar(await criarRepositorios(), await f.text());
      setResumo(
        Object.entries(ROTULOS)
          .map(([k, nome]) => `${r[k as keyof typeof r]} ${nome}`)
          .join(", "),
      );
      mostrar("Backup importado.");
    } catch (e) {
      setErro(e instanceof BackupInvalidoError ? e.message : "Não consegui importar esse arquivo.");
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Backup</h2>
      <p className="text-sm text-texto/70">Seus dados ficam só neste aparelho. Exporte um arquivo de vez em quando e guarde fora do celular.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variante="secundario" onClick={() => void baixar()}>
          Exportar backup
        </Button>
        <Button variante="secundario" onClick={() => arquivo.current?.click()}>
          Importar backup
        </Button>
      </div>
      <input
        ref={arquivo}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="Arquivo de backup"
        onChange={(e) => {
          void restaurar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {erro ? <Alert tipo="erro">{erro}</Alert> : null}
      {resumo ? <Alert tipo="info">Importado: {resumo}.</Alert> : null}
    </Card>
  );
}
