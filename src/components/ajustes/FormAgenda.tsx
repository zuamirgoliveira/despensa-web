"use client";

import { useState } from "react";
import { Alert, Button, Card, Select } from "@/components/ui";
import { criarRepositorios } from "@/data";
import type { AgendaIda, Mercado, TipoIda } from "@/domain/types";
import { validarAgenda, valoresDaAgenda } from "@/lib/formAjustes";
import { TIPO_IDA_ROTULO } from "@/lib/rotulos";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Props = {
  tipo: TipoIda;
  casaId: string;
  agenda: AgendaIda | undefined;
  mercados: readonly Mercado[];
  aoSalvar: () => void;
};

export function FormAgenda({ tipo, casaId, agenda, mercados, aoSalvar }: Props) {
  const [v, setV] = useState(() => valoresDaAgenda(agenda));
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const mensal = tipo === "feira_mensal";
  const configurada = agenda !== undefined;
  const aberto = !configurada || editando;
  const mercado = mercados.find((m) => m.id === agenda?.mercadoId);
  const dia = agenda?.diaDoMes ?? agenda?.diaDaSemana;
  const resumo =
    configurada && dia !== undefined
      ? `${mensal ? `Dia ${dia} do mês` : DIAS_SEMANA[dia]} · ${mercado ? mercado.apelido || mercado.nome : "sem mercado habitual"}`
      : "Não configurada";

  async function salvar(): Promise<void> {
    const r = validarAgenda(tipo, casaId, agenda, v, () => crypto.randomUUID());
    if (!r.ok) return setErro(r.erro);
    setErro(null);
    await (await criarRepositorios()).agendas.salvar(r.agenda);
    setEditando(false);
    aoSalvar();
  }

  function cancelar(): void {
    setV(valoresDaAgenda(agenda));
    setErro(null);
    setEditando(false);
  }

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{TIPO_IDA_ROTULO[tipo]}</h3>
          <p className="text-sm text-suave" aria-label={`Resumo: ${TIPO_IDA_ROTULO[tipo]}`}>
            {resumo}
          </p>
        </div>
        {configurada && !editando ? (
          <Button variante="secundario" className="shrink-0" aria-label={`Alterar ${TIPO_IDA_ROTULO[tipo]}`} onClick={() => setEditando(true)}>
            Alterar
          </Button>
        ) : null}
      </div>
      {aberto ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Select rotulo={mensal ? "Dia do mês" : "Dia da semana"} value={v.dia} onChange={(e) => setV({ ...v, dia: e.target.value })}>
              <option value="">Escolha…</option>
              {mensal
                ? Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))
                : DIAS_SEMANA.map((nome, i) => (
                    <option key={nome} value={i}>
                      {nome}
                    </option>
                  ))}
            </Select>
            <Select rotulo="Mercado habitual" value={v.mercadoId} onChange={(e) => setV({ ...v, mercadoId: e.target.value })}>
              <option value="">Nenhum</option>
              {mercados.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.apelido || m.nome}
                </option>
              ))}
            </Select>
          </div>
          {mensal ? <p className="text-xs text-suave">Em meses mais curtos, a ida cai no último dia do mês.</p> : null}
          {erro ? <Alert tipo="erro">{erro}</Alert> : null}
          <div className={configurada ? "grid grid-cols-2 gap-2" : undefined}>
            <Button variante="secundario" onClick={() => void salvar()}>
              Salvar agenda
            </Button>
            {configurada ? (
              <Button variante="secundario" onClick={cancelar}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </Card>
  );
}
