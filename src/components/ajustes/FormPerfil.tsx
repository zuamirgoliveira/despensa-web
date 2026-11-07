"use client";

import { useState } from "react";
import { Alert, Button, Card, Details, Input } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { custoPorKmCarro } from "@/domain/ida";
import type { Perfil } from "@/domain/types";
import { brl } from "@/lib/format";
import { validarPerfil, valoresDoPerfil, type CampoPerfil, type ValoresPerfil } from "@/lib/formAjustes";

export function FormPerfil({ perfil, aoSalvar }: { perfil: Perfil; aoSalvar: () => void }) {
  const [v, setV] = useState<ValoresPerfil>(() => valoresDoPerfil(perfil));
  const [erros, setErros] = useState<Partial<Record<CampoPerfil, string>>>({});
  const [abertoRegras, setAbertoRegras] = useState(false);
  const [abertoCustos, setAbertoCustos] = useState(false);
  const muda = (c: CampoPerfil) => (e: { target: { value: string } }) => setV((a) => ({ ...a, [c]: e.target.value }));

  // custo por km mostrado ao vivo, com o que está digitado (quando válido)
  const previa = validarPerfil(perfil, v);
  const kmCarro = previa.ok ? custoPorKmCarro(previa.perfil.carro) : undefined;
  const kmBike = previa.ok ? previa.perfil.bikeCentavosPorKm : undefined;

  async function salvar(secao: "regras" | "custos"): Promise<void> {
    const r = validarPerfil(perfil, v);
    if (!r.ok) {
      // abre a seção que tem campo com erro, para a pessoa ver o que corrigir
      const campos = Object.keys(r.erros);
      if (campos.some((c) => ["folgaDias", "limiarAlertaPrecoPct", "janelaPrecoDias"].includes(c))) setAbertoRegras(true);
      if (campos.some((c) => ["consumoKmPorLitro", "precoCombustivel", "desgastePorKm", "bikePorKm"].includes(c))) setAbertoCustos(true);
      return setErros(r.erros);
    }
    setErros({});
    await (await criarRepositorios()).perfis.salvar(r.perfil);
    (secao === "regras" ? setAbertoRegras : setAbertoCustos)(false);
    aoSalvar();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Details
          semBorda
          aberto={abertoRegras}
          aoAlternar={setAbertoRegras}
          titulo={
            <span className="flex flex-col">
              <span className="font-titulo text-sm">Regras da lista e dos preços</span>
              <span className="text-sm font-normal text-suave" aria-label="Resumo das regras">
                Folga {perfil.folgaDias} d · Alerta {String(perfil.limiarAlertaPrecoPct).replace(".", ",")}% · Janela {perfil.janelaPrecoDias} d
              </span>
            </span>
          }
        >
          <div className="flex flex-col gap-3">
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
            {Object.keys(erros).length ? <Alert tipo="erro">Corrija os campos destacados.</Alert> : null}
            <Button onClick={() => void salvar("regras")}>Salvar regras</Button>
          </div>
        </Details>
      </Card>

      <Card>
        <Details
          semBorda
          aberto={abertoCustos}
          aoAlternar={setAbertoCustos}
          titulo={
            <span className="flex flex-col">
              <span className="font-titulo text-sm">Custo da ida</span>
              <span className="text-sm font-normal text-suave" aria-label="Resumo dos custos">
                Carro {brl(custoPorKmCarro(perfil.carro))}/km · Bike {brl(perfil.bikeCentavosPorKm)}/km
              </span>
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            <Input
              rotulo="Consumo do carro (km por litro)"
              inputMode="decimal"
              value={v.consumoKmPorLitro}
              onChange={muda("consumoKmPorLitro")}
              erro={erros.consumoKmPorLitro}
            />
            <Input
              rotulo="Preço do combustível (R$ por litro)"
              inputMode="decimal"
              value={v.precoCombustivel}
              onChange={muda("precoCombustivel")}
              erro={erros.precoCombustivel}
            />
            <Input
              rotulo="Desgaste do carro (R$ por km)"
              inputMode="decimal"
              value={v.desgastePorKm}
              onChange={muda("desgastePorKm")}
              erro={erros.desgastePorKm}
            />
            <Input rotulo="Bike elétrica (R$ por km)" inputMode="decimal" value={v.bikePorKm} onChange={muda("bikePorKm")} erro={erros.bikePorKm} />
            {kmCarro !== undefined && kmBike !== undefined ? (
              <Alert tipo="info" aria-label="Custo estimado por km">
                Carro: {brl(kmCarro)} por km · Bike elétrica: {brl(kmBike)} por km. Só dinheiro: o tempo não entra na conta.
              </Alert>
            ) : null}
            {Object.keys(erros).length ? <Alert tipo="erro">Corrija os campos destacados.</Alert> : null}
            <Button onClick={() => void salvar("custos")}>Salvar custos</Button>
          </div>
        </Details>
      </Card>
    </div>
  );
}
