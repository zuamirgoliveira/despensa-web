"use client";

import { useState } from "react";
import { Alert, Button, Card, Input, Select } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { custoIdaDoMercado } from "@/domain/ida";
import type { Mercado, Perfil } from "@/domain/types";
import { centavosParaCampo, reaisParaCentavos } from "@/lib/dinheiro";
import { brl } from "@/lib/format";
import { TIPOS_MERCADO, TRANSPORTES } from "@/schemas";

const TIPO_ROTULO: Record<Mercado["tipo"], string> = {
  hortifruti: "Hortifruti",
  supermercado: "Supermercado",
  atacarejo: "Atacarejo",
  feira: "Feira",
  outro: "Outro",
};
const TRANSPORTE_ROTULO: Record<Mercado["transporte"], string> = { carro: "Carro", bike_eletrica: "Bike elétrica" };

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

  const km = numero(v.km);
  const min = numero(v.min);
  const fixo = reaisParaCentavos(v.fixo);
  const previa =
    km !== undefined && !Number.isNaN(km)
      ? custoIdaDoMercado({ transporte: v.transporte, distanciaKm: km, custoFixoIdaCentavos: fixo }, perfil)
      : undefined;

  async function salvar(): Promise<void> {
    if (Number.isNaN(km) || Number.isNaN(min) || (v.fixo.trim() !== "" && fixo === undefined)) {
      return setErro("Informe números válidos (maiores ou iguais a zero) em distância, tempo e custo fixo.");
    }
    setErro(null);
    await (await criarRepositorios()).mercados.salvar({
      ...mercado,
      apelido: v.apelido.trim() || undefined,
      tipo: v.tipo,
      transporte: v.transporte,
      distanciaKm: km,
      tempoMinIda: min,
      custoFixoIdaCentavos: fixo,
    });
    aoSalvar();
  }

  const nome = mercado.apelido || mercado.nome;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{nome}</h2>
        <p className="text-xs text-texto/70">{mercado.endereco || "Endereço não informado"}</p>
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
        <Input rotulo="Distância de ida (km)" inputMode="decimal" value={v.km} onChange={(e) => setV({ ...v, km: e.target.value })} ajuda="Só a ida: o custo conta ida e volta." />
        <Input rotulo="Tempo de ida (min)" inputMode="decimal" value={v.min} onChange={(e) => setV({ ...v, min: e.target.value })} ajuda="Só informação, não vira dinheiro." />
      </div>
      {v.transporte === "carro" ? (
        <Input rotulo="Custo fixo da ida (R$, ex.: estacionamento)" inputMode="decimal" value={v.fixo} onChange={(e) => setV({ ...v, fixo: e.target.value })} />
      ) : null}
      <p className="font-medium" aria-label={`Custo da ida a ${nome}`}>
        {previa === undefined ? "Custo da ida: informe a distância." : `Custo da ida e volta: ${brl(previa)}`}
      </p>
      {erro ? <Alert tipo="erro">{erro}</Alert> : null}
      <Button variante="secundario" onClick={() => void salvar()}>
        Salvar mercado
      </Button>
    </Card>
  );
}
