"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Input, Select } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { confirmarEstimativa, estimarMercado, type ResultadoEstimativa } from "@/data/estimativaIda";
import type { MeioDeTransporte } from "@/domain/ida";
import { brl, numeroBR } from "@/lib/format";
import { criarMapas } from "@/lib/mapas";

type Props = { mercadoId: string; aoConcluir: () => void };
type Estado =
  | { fase: "carregando" }
  | { fase: "resultado"; r: ResultadoEstimativa & { status: "ok" }; nome: string }
  | { fase: "manual"; motivo: string }
  | { fase: "pronto"; custo: number | undefined };

const MOTIVO_MANUAL: Record<string, string> = {
  sem_casa: "Cadastre a localização da casa em Ajustes para estimar sozinho. Por enquanto, informe a distância.",
  offline: "Sem internet agora, então a estimativa automática fica pendente. Informe a distância ou refaça depois em Mercados.",
  endereco_nao_encontrado: "Não achei o endereço da nota no mapa. Informe a distância e o tempo uma vez.",
  falha: "O serviço de mapas não respondeu. Informe a distância e o tempo uma vez ou refaça depois em Mercados.",
};

/** Estimativa da ida ao importar a nota (informativa e nunca bloqueia): confirma com um toque. */
export function EstimativaIda({ mercadoId, aoConcluir }: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [meio, setMeio] = useState<MeioDeTransporte>("carro");
  const [manual, setManual] = useState({ km: "", min: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    (async () => {
      const repos = await criarRepositorios();
      const nome = (await repos.mercados.obter(mercadoId))?.apelido || (await repos.mercados.obter(mercadoId))?.nome || "Mercado";
      const r = await estimarMercado(repos, criarMapas(), mercadoId, "carro", { online: navigator.onLine });
      setEstado(r.status === "ok" ? { fase: "resultado", r, nome } : { fase: "manual", motivo: MOTIVO_MANUAL[r.status] });
    })();
  }, [mercadoId]);

  async function escolher(escolhido: MeioDeTransporte): Promise<void> {
    if (estado.fase !== "resultado") return;
    setTrabalhando(true);
    setErro(null);
    try {
      const repos = await criarRepositorios();
      let { distanciaKm, tempoMin } = estado.r;
      if (escolhido !== "carro") {
        const r = await estimarMercado(repos, criarMapas(), mercadoId, escolhido, { online: navigator.onLine });
        if (r.status !== "ok") return setEstado({ fase: "manual", motivo: MOTIVO_MANUAL[r.status] });
        ({ distanciaKm, tempoMin } = r);
      }
      const { custoIdaCentavos } = await confirmarEstimativa(repos, mercadoId, { meio: escolhido, distanciaKm, tempoMin });
      setEstado({ fase: "pronto", custo: custoIdaCentavos });
    } finally {
      setTrabalhando(false);
    }
  }

  async function salvarManual(): Promise<void> {
    const km = Number(manual.km.replace(",", "."));
    const min = manual.min.trim() === "" ? undefined : Number(manual.min.replace(",", "."));
    if (!Number.isFinite(km) || km < 0 || (min !== undefined && (!Number.isFinite(min) || min < 0))) {
      return setErro("Informe números válidos (maiores ou iguais a zero).");
    }
    setErro(null);
    const { custoIdaCentavos } = await confirmarEstimativa(await criarRepositorios(), mercadoId, { meio, distanciaKm: km, tempoMin: min });
    setEstado({ fase: "pronto", custo: custoIdaCentavos });
  }

  return (
    <Card className="flex flex-col gap-3" aria-label="Estimativa da ida">
      <h2 className="text-lg font-semibold">Quanto custou a ida?</h2>

      {estado.fase === "carregando" ? <p aria-live="polite">Estimando a distância...</p> : null}

      {estado.fase === "resultado" ? (
        <>
          <p aria-live="polite">
            {estado.nome}, {numeroBR(estado.r.distanciaKm, 1)} km, cerca de {estado.r.tempoMin} min.
            {estado.r.aproximado ? " (aproximado: só achei o bairro)" : ""} Você foi de carro ou de bike elétrica?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={trabalhando} onClick={() => void escolher("carro")}>
              De carro
            </Button>
            <Button disabled={trabalhando} variante="secundario" onClick={() => void escolher("bike_eletrica")}>
              De bike elétrica
            </Button>
          </div>
        </>
      ) : null}

      {estado.fase === "manual" ? (
        <>
          <Alert tipo="aviso">{estado.motivo}</Alert>
          {estado.motivo === MOTIVO_MANUAL.sem_casa ? (
            <Link href="/ajustes" className="inline-flex min-h-11 items-center font-medium text-verde underline">
              Ir para Ajustes
            </Link>
          ) : null}
          <Select rotulo="Como você foi" value={meio} onChange={(e) => setMeio(e.target.value as MeioDeTransporte)}>
            <option value="carro">Carro</option>
            <option value="bike_eletrica">Bike elétrica</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input rotulo="Distância de ida (km)" inputMode="decimal" value={manual.km} onChange={(e) => setManual({ ...manual, km: e.target.value })} />
            <Input rotulo="Tempo de ida (min)" inputMode="decimal" value={manual.min} onChange={(e) => setManual({ ...manual, min: e.target.value })} />
          </div>
          {erro ? <Alert tipo="erro">{erro}</Alert> : null}
          <Button variante="secundario" onClick={() => void salvarManual()}>
            Guardar distância
          </Button>
        </>
      ) : null}

      {estado.fase === "pronto" ? (
        <p aria-live="polite" aria-label="Custo da ida registrado">
          {estado.custo === undefined ? "Distância guardada." : `Custo da ida e volta: ${brl(estado.custo)}. Já está na compra.`}
        </p>
      ) : null}

      <Button variante={estado.fase === "pronto" ? "primario" : "secundario"} onClick={aoConcluir}>
        {estado.fase === "pronto" ? "Continuar" : "Decidir depois"}
      </Button>
    </Card>
  );
}
