"use client";

import { useState } from "react";
import { Alert, Button, Card, Dialog, Input, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { apagarTodosOsDados, contagemDoAparelho } from "@/data/apagarTudo";
import { guardarCopiaNoNavegador } from "./copiaNavegador";

const PALAVRA = "APAGAR";
type Passo = "fechado" | "aviso" | "confirmar";
type Contagem = Awaited<ReturnType<typeof contagemDoAparelho>>;

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

/** Zona de perigo: apaga todos os dados do aparelho, com explicação do risco e duas confirmações. */
export function ApagarTudo() {
  const { mostrar } = useToast();
  const [passo, setPasso] = useState<Passo>("fechado");
  const [contagem, setContagem] = useState<Contagem | null>(null);
  const [copiaFeita, setCopiaFeita] = useState(false);
  const [entendi, setEntendi] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function abrir(): Promise<void> {
    setContagem(await contagemDoAparelho(await criarRepositorios()));
    setCopiaFeita(false);
    setEntendi(false);
    setDigitado("");
    setPasso("aviso");
  }

  function fechar(): void {
    setPasso("fechado");
    setDigitado("");
    setEntendi(false);
  }

  async function guardarCopia(): Promise<void> {
    try {
      const r = await guardarCopiaNoNavegador();
      if (r.via !== "cancelado") setCopiaFeita(true);
    } catch {
      mostrar("Não consegui guardar a cópia de segurança.", "erro");
    }
  }

  async function apagar(): Promise<void> {
    setOcupado(true);
    try {
      await apagarTodosOsDados(await criarRepositorios());
      mostrar("Todos os dados foram apagados.");
      // recarrega de propósito: zera todo o estado em memória
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } catch {
      mostrar("Não consegui apagar. Nada foi alterado.", "erro");
      setOcupado(false);
    }
  }

  const liberado = entendi && digitado.trim().toUpperCase() === PALAVRA && !ocupado;

  return (
    <Card className="flex flex-col gap-3 border-erro/40">
      <h2 className="text-sm">Zona de perigo</h2>
      <p className="text-sm text-suave">Apaga tudo o que o app guarda neste aparelho. Use para recomeçar do zero.</p>
      <Button variante="perigo" onClick={() => void abrir()}>
        Apagar todos os dados
      </Button>

      <Dialog
        aberto={passo === "aviso"}
        titulo="Apagar todos os dados?"
        rotuloConfirmar="Continuar"
        perigo
        aoConfirmar={() => setPasso("confirmar")}
        aoCancelar={fechar}
      >
        <div className="flex flex-col gap-3 text-sm">
          <Alert tipo="erro">Isto não tem volta. Os dados só existem neste aparelho: não há servidor nem nuvem para recuperar depois.</Alert>
          {contagem ? (
            <p>
              Serão apagados: {plural(contagem.compras, "compra", "compras")}, {plural(contagem.produtos, "produto", "produtos")} da despensa (com quantidades e
              padrões), {plural(contagem.mercados, "mercado", "mercados")}, {plural(contagem.listas, "lista", "listas")}, o histórico de preços, a agenda, a
              localização de casa e os ajustes.
            </p>
          ) : null}
          <p>O app volta ao estado da primeira abertura. A escolha de tema (claro/escuro) é mantida.</p>
          <p className="font-medium">Antes de continuar, guarde uma cópia de segurança: é a única forma de voltar atrás (Ajustes → Restaurar).</p>
          <Button variante="secundario" onClick={() => void guardarCopia()}>
            Guardar uma cópia agora
          </Button>
          {copiaFeita ? <p className="text-sucesso">Cópia de segurança guardada.</p> : <p className="text-suave">Recomendado.</p>}
        </div>
      </Dialog>

      <Dialog
        aberto={passo === "confirmar"}
        titulo="Última confirmação"
        rotuloConfirmar={ocupado ? "Apagando..." : "Apagar tudo"}
        perigo
        confirmarDesabilitado={!liberado}
        aoConfirmar={() => void apagar()}
        aoCancelar={fechar}
      >
        <div className="flex flex-col gap-3 text-sm">
          {!copiaFeita ? <Alert tipo="aviso">Você ainda não guardou uma cópia de segurança nesta tela.</Alert> : null}
          <label className="flex min-h-11 items-start gap-2">
            <input type="checkbox" className="mt-0.5 size-5" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} />
            Entendi que tudo será apagado e que não há como desfazer.
          </label>
          <Input
            rotulo={`Digite ${PALAVRA} para confirmar`}
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
      </Dialog>
    </Card>
  );
}
