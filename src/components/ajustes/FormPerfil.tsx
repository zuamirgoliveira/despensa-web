"use client";

import { useState } from "react";
import { Alert, Button, Card, Input } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { custoPorKmCarro } from "@/domain/ida";
import type { Perfil } from "@/domain/types";
import { brl } from "@/lib/format";
import { validarPerfil, valoresDoPerfil, type CampoPerfil, type ValoresPerfil } from "@/lib/formAjustes";

export function FormPerfil({ perfil, aoSalvar }: { perfil: Perfil; aoSalvar: () => void }) {
  const [v, setV] = useState<ValoresPerfil>(() => valoresDoPerfil(perfil));
  const [erros, setErros] = useState<Partial<Record<CampoPerfil, string>>>({});
  const muda = (c: CampoPerfil) => (e: { target: { value: string } }) => setV((a) => ({ ...a, [c]: e.target.value }));

  // custo por km mostrado ao vivo, com o que está digitado (quando válido)
  const previa = validarPerfil(perfil, v);
  const kmCarro = previa.ok ? custoPorKmCarro(previa.perfil.carro) : undefined;
  const kmBike = previa.ok ? previa.perfil.bikeCentavosPorKm : undefined;

  async function salvar(): Promise<void> {
    const r = validarPerfil(perfil, v);
    if (!r.ok) return setErros(r.erros);
    setErros({});
    await (await criarRepositorios()).perfis.salvar(r.perfil);
    aoSalvar();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="text-sm">Regras da lista e dos preços</h2>
        <Input
          rotulo="Folga em dias"
          inputMode="numeric"
          value={v.folgaDias}
          onChange={muda("folgaDias")}
          erro={erros.folgaDias}
          ajuda="Dias a mais de cobertura além da próxima ida. Quanto maior, mais itens entram na lista."
        />
        <Input
          rotulo="Alerta de preço (% acima da sua média)"
          inputMode="decimal"
          value={v.limiarAlertaPrecoPct}
          onChange={muda("limiarAlertaPrecoPct")}
          erro={erros.limiarAlertaPrecoPct}
        />
        <Input
          rotulo="Janela de comparação de preços (dias)"
          inputMode="numeric"
          value={v.janelaPrecoDias}
          onChange={muda("janelaPrecoDias")}
          erro={erros.janelaPrecoDias}
          ajuda="Só preços dessa janela entram em 'melhor mercado' e na cesta."
        />
        <Input
          rotulo="Economia mínima para dividir a lista (R$)"
          inputMode="decimal"
          value={v.economiaMinimaDivisao}
          onChange={muda("economiaMinimaDivisao")}
          erro={erros.economiaMinimaDivisao}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm">Custo da ida</h2>
        <Input rotulo="Consumo do carro (km por litro)" inputMode="decimal" value={v.consumoKmPorLitro} onChange={muda("consumoKmPorLitro")} erro={erros.consumoKmPorLitro} />
        <Input rotulo="Preço do combustível (R$ por litro)" inputMode="decimal" value={v.precoCombustivel} onChange={muda("precoCombustivel")} erro={erros.precoCombustivel} />
        <Input rotulo="Desgaste do carro (R$ por km)" inputMode="decimal" value={v.desgastePorKm} onChange={muda("desgastePorKm")} erro={erros.desgastePorKm} />
        <Input rotulo="Bike elétrica (R$ por km)" inputMode="decimal" value={v.bikePorKm} onChange={muda("bikePorKm")} erro={erros.bikePorKm} />
        {kmCarro !== undefined && kmBike !== undefined ? (
          <Alert tipo="info" aria-label="Custo estimado por km">
            Carro: {brl(kmCarro)} por km · Bike elétrica: {brl(kmBike)} por km. Só dinheiro: o tempo não entra na conta.
          </Alert>
        ) : null}
      </Card>

      {Object.keys(erros).length ? <Alert tipo="erro">Corrija os campos destacados.</Alert> : null}
      <Button onClick={() => void salvar()}>Salvar regras e custos</Button>
    </div>
  );
}
