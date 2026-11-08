"use client";

import { useState } from "react";
import { Alert, Button, Card, Input, Select } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { estimarMercado } from "@/data/estimativaIda";
import { custoIdaDoMercado } from "@/domain/ida";
import type { Mercado, Perfil } from "@/domain/types";
import { centavosParaCampo, reaisParaCentavos } from "@/lib/dinheiro";
import { brl } from "@/lib/format";
import { criarMapas } from "@/lib/mapas";
import { aplicarCustoNasCompras } from "@/data/estimativaIda";
import { TIPOS_MERCADO, TRANSPORTES } from "@/schemas";

const TIPO_ROTULO: Record<Mercado["tipo"], string> = {
  hortifruti: "Hortifruti",
  supermercado: "Supermercado",
  atacarejo: "Atacarejo",
  padaria: "Padaria",
  acougue: "Açougue",
  lanchonete: "Lanchonete / restaurante",
  farmacia: "Farmácia",
  conveniencia: "Conveniência",
  feira: "Feira",
  outro: "Outro",
};
const TRANSPORTE_ROTULO: Record<Mercado["transporte"], string> = { carro: "Carro", bike_eletrica: "Bike elétrica", a_pe: "A pé" };

const numero = (s: string): number | undefined => {
  if (s.trim() === "") return undefined;
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
};

export function FormMercado({ mercado, perfil, aoSalvar }: { mercado: Mercado; perfil: Perfil; aoSalvar: () => void }) {
  const [v, setV] = useState({
    apelido: mercado.apelido ?? "",
    tipo: mercado.tipo,
    transporte: mercado.transporte,
    km: mercado.distanciaKm === undefined ? "" : String(mercado.distanciaKm).replace(".", ","),
    min: mercado.tempoMinIda === undefined ? "" : String(mercado.tempoMinIda).replace(".", ","),
    fixo: centavosParaCampo(mercado.custoFixoIdaCentavos),
  });
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [estimando, setEstimando] = useState(false);

  async function estimar(): Promise<void> {
    setEstimando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await estimarMercado(await criarRepositorios(), criarMapas(), mercado.id, v.transporte, { online: navigator.onLine });
      if (r.status === "ok") {
        setV((a) => ({ ...a, km: String(r.distanciaKm).replace(".", ","), min: String(r.tempoMin) }));
        setAviso(`Estimativa preenchida${r.aproximado ? " (aproximada: só achei o bairro)" : ""}. Confira e toque em Salvar mercado.`);
      } else {
        setErro(
          {
            sem_casa: "Cadastre a localização da casa em Ajustes para estimar.",
            offline: "Sem internet agora. Informe a distância à mão ou tente depois.",
            endereco_nao_encontrado: "Não achei o endereço no mapa. Informe a distância à mão.",
            falha: "O serviço de mapas não respondeu. Informe a distância à mão ou tente depois.",
          }[r.status],
        );
      }
    } finally {
      setEstimando(false);
    }
  }

  const km = numero(v.km);
  const min = numero(v.min);
  const fixo = reaisParaCentavos(v.fixo);
  const previa =
    km !== undefined && !Number.isNaN(km) ? custoIdaDoMercado({ transporte: v.transporte, distanciaKm: km, custoFixoIdaCentavos: fixo }, perfil) : undefined;

  async function salvar(): Promise<void> {
    if (Number.isNaN(km) || Number.isNaN(min) || (v.fixo.trim() !== "" && fixo === undefined)) {
      return setErro("Informe números válidos (maiores ou iguais a zero) em distância, tempo e custo fixo.");
    }
    setErro(null);
    const repos = await criarRepositorios();
    const salvo = await repos.mercados.salvar({
      ...mercado,
      apelido: v.apelido.trim() || undefined,
      tipo: v.tipo,
      transporte: v.transporte,
      distanciaKm: km,
      tempoMinIda: min,
      custoFixoIdaCentavos: fixo,
    });
    // compras já importadas sem custo da ida passam a ter (some o aviso "falta estimar" da tela inicial)
    await aplicarCustoNasCompras(repos, salvo);
    aoSalvar();
  }

  const nome = mercado.apelido || mercado.nome;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-sans text-base font-semibold">{nome}</h2>
        <p className="text-xs text-suave">{mercado.endereco || "Endereço não informado"}</p>
      </div>
      <Input rotulo="Apelido" value={v.apelido} onChange={(e) => setV({ ...v, apelido: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Select rotulo="Tipo" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as Mercado["tipo"] })}>
          {TIPOS_MERCADO.map((t) => (
            <option key={t} value={t}>
              {TIPO_ROTULO[t]}
            </option>
          ))}
        </Select>
        <Select rotulo="Como você vai" value={v.transporte} onChange={(e) => setV({ ...v, transporte: e.target.value as Mercado["transporte"] })}>
          {TRANSPORTES.map((t) => (
            <option key={t} value={t}>
              {TRANSPORTE_ROTULO[t]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          rotulo="Distância de ida (km)"
          inputMode="decimal"
          value={v.km}
          onChange={(e) => setV({ ...v, km: e.target.value })}
          ajuda="Só a ida: o custo conta ida e volta."
        />
        <Input
          rotulo="Tempo de ida (min)"
          inputMode="decimal"
          value={v.min}
          onChange={(e) => setV({ ...v, min: e.target.value })}
          ajuda="Só informação, não vira dinheiro."
        />
      </div>
      {v.transporte === "carro" ? (
        <Input rotulo="Custo fixo da ida (R$, ex.: estacionamento)" inputMode="decimal" value={v.fixo} onChange={(e) => setV({ ...v, fixo: e.target.value })} />
      ) : null}
      <p className="font-medium" aria-label={`Custo da ida a ${nome}`}>
        {previa === undefined ? "Custo da ida: informe a distância." : `Custo da ida e volta: ${brl(previa)}`}
      </p>
      {erro ? <Alert tipo="erro">{erro}</Alert> : null}
      {aviso ? <Alert tipo="info">{aviso}</Alert> : null}
      <Button variante="secundario" disabled={estimando} onClick={() => void estimar()}>
        {estimando ? "Estimando..." : "Estimar pelo endereço"}
      </Button>
      <Button variante="secundario" onClick={() => void salvar()}>
        Salvar mercado
      </Button>
    </Card>
  );
}
