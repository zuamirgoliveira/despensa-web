"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Input, Progress } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { carregarFila, registrarConferencia, registrarNivel } from "@/data/conferencia";
import { proximaIdaDoTipo } from "@/domain/agenda";
import type { ProdutoParaConferir } from "@/domain/conferencia";
import type { Nivel, TipoIda } from "@/domain/types";
import { TIPOS_IDA } from "@/schemas";
import { hojeRecife, segundosDesde } from "@/lib/datas";
import { dataBR } from "@/lib/format";
import { TIPO_IDA_ROTULO } from "@/lib/rotulos";

const NIVEIS: { nivel: Nivel; rotulo: string; classe: string }[] = [
  { nivel: "cheio", rotulo: "Cheio", classe: "" },
  { nivel: "metade", rotulo: "Metade", classe: "" },
  { nivel: "acabando", rotulo: "Acabando", classe: "" },
  { nivel: "acabou", rotulo: "Acabou", classe: "" },
];
const ROTULO_NIVEL: Record<Nivel, string> = { cheio: "Cheio", metade: "Metade", acabando: "Acabando", acabou: "Acabou" };
const MOTIVO: Record<ProdutoParaConferir["motivo"], string> = {
  na_lista: "Pode entrar na lista desta ida",
  provavelmente_acabando: "Provavelmente acabando",
  desatualizado: "Faz tempo que você não confere",
  sem_registro: "Ainda sem nível registrado",
};

type Idas = { tipo: TipoIda; data: string }[];

export function Conferencia() {
  const [idas, setIdas] = useState<Idas | null>(null);
  const [tipo, setTipo] = useState<TipoIda | null>(null);
  const [fila, setFila] = useState<ProdutoParaConferir[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [conferidos, setConferidos] = useState(0);
  const [rupturas, setRupturas] = useState(0);
  const [quantidade, setQuantidade] = useState("");
  const [fim, setFim] = useState<{ segundos: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inicio = useRef<Date | null>(null);

  async function iniciar(t: TipoIda): Promise<void> {
    setErro(null);
    const lista = await carregarFila(await criarRepositorios(), t, hojeRecife());
    if (!lista) return setErro("Este tipo de ida não tem agenda. Configure em Ajustes.");
    inicio.current = new Date();
    setTipo(t);
    setFila(lista);
    setIndice(0);
    setConferidos(0);
    setRupturas(0);
    setQuantidade("");
    setFim(lista.length ? null : { segundos: 0 });
  }

  async function terminar(total: number, rupturasTotal: number = rupturas): Promise<void> {
    const comeco = inicio.current ?? new Date();
    const segundos = segundosDesde(comeco);
    if (tipo && total > 0) {
      await registrarConferencia(await criarRepositorios(), {
        tipoIda: tipo,
        iniciadaEm: comeco.toISOString(),
        duracaoSegundos: segundos,
        produtosConferidos: total,
        rupturas: rupturasTotal,
      });
    }
    setFim({ segundos });
  }

  async function responder(item: ProdutoParaConferir, nivel: Nivel): Promise<void> {
    const q = quantidade.trim() === "" ? undefined : Number(quantidade.replace(",", "."));
    if (q !== undefined && (!Number.isFinite(q) || q < 0)) return setErro("Quantidade exata inválida.");
    setErro(null);
    const salvo = await registrarNivel(await criarRepositorios(), item.produto, nivel, new Date(), q);
    const total = conferidos + 1;
    const rup = rupturas + (salvo.ruptura ? 1 : 0);
    setConferidos(total);
    setRupturas(rup);
    setQuantidade("");
    if (fila && indice + 1 >= fila.length) await terminar(total, rup);
    else setIndice((i) => i + 1);
  }

  async function pular(): Promise<void> {
    setQuantidade("");
    if (fila && indice + 1 >= fila.length) await terminar(conferidos);
    else setIndice((i) => i + 1);
  }

  // próximas idas (para escolher) e tipo vindo da URL (?ida=)
  useEffect(() => {
    let ativo = true;
    (async () => {
      const r = await criarRepositorios();
      await r.iniciar();
      const agendas = await r.agendas.listar();
      const hoje = hojeRecife();
      const lista = TIPOS_IDA.flatMap((t) => {
        const i = proximaIdaDoTipo(agendas, t, hoje);
        return i ? [{ tipo: t, data: i.data }] : [];
      });
      if (!ativo) return;
      setIdas(lista);
      const pedido = new URLSearchParams(location.search).get("ida");
      if (pedido && (TIPOS_IDA as readonly string[]).includes(pedido)) void iniciar(pedido as TipoIda);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (!idas) return <p aria-live="polite">Carregando...</p>;

  if (!tipo || !fila) {
    return (
      <div className="flex flex-col gap-3">
        <p>Para qual ida você quer conferir a despensa?</p>
        {idas.map((i) => (
          <Button key={i.tipo} variante="secundario" className="h-auto justify-between py-3" onClick={() => void iniciar(i.tipo)}>
            <span>{TIPO_IDA_ROTULO[i.tipo]}</span>
            <span className="text-sm font-normal text-texto/70">{dataBR(i.data)}</span>
          </Button>
        ))}
        {idas.length === 0 ? <Alert>Nenhuma agenda de ida configurada. Defina as datas em Ajustes.</Alert> : null}
        {erro ? <Alert tipo="erro">{erro}</Alert> : null}
      </div>
    );
  }

  if (fim) {
    const min = Math.floor(fim.segundos / 60);
    const seg = fim.segundos % 60;
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{fila.length === 0 ? "Nada para conferir" : "Conferência concluída"}</h2>
        <p>
          {fila.length === 0
            ? "Nenhum produto precisa de conferência para esta ida."
            : `${conferidos} de ${fila.length} produtos conferidos em ${min > 0 ? `${min} min ` : ""}${seg} s.`}
        </p>
        <Link
          href={`/lista?ida=${tipo}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-verde px-4 py-2 font-medium text-white"
        >
          Gerar lista
        </Link>
      </Card>
    );
  }

  const item = fila[indice];
  const { produto } = item;
  return (
    <div className="flex flex-col gap-4">
      <Progress rotulo="Progresso da conferência" valor={indice} maximo={fila.length} />
      <p className="text-sm text-texto/70" aria-live="polite">
        Produto {indice + 1} de {fila.length} · {item.local}
      </p>
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{produto.nome}</h2>
          <p className="text-sm text-texto/70">{MOTIVO[item.motivo]}</p>
          {item.nivelAtual ? <p className="text-sm">Registrado: {ROTULO_NIVEL[item.nivelAtual]}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3" role="group" aria-label={`Quanto ainda tem de ${produto.nome}`}>
          {NIVEIS.map((n) => (
            <Button key={n.nivel} className="min-h-16 text-lg" onClick={() => void responder(item, n.nivel)}>
              {n.rotulo}
            </Button>
          ))}
        </div>

        {item.nivelEstimado ? (
          <Button variante="secundario" onClick={() => void responder(item, item.nivelEstimado as Nivel)}>
            Mesmo que o estimado ({ROTULO_NIVEL[item.nivelEstimado]})
          </Button>
        ) : null}

        {produto.contavel ? (
          <Input
            rotulo="Quantidade exata (opcional)"
            inputMode="decimal"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            ajuda="Digite antes de tocar no nível."
          />
        ) : null}
        {erro ? <Alert tipo="erro">{erro}</Alert> : null}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Button variante="secundario" disabled={indice === 0} onClick={() => setIndice((i) => Math.max(0, i - 1))}>
          Voltar
        </Button>
        <Button variante="secundario" onClick={() => void pular()}>
          Pular
        </Button>
        <Button variante="secundario" onClick={() => void terminar(conferidos)}>
          Concluir antes
        </Button>
      </div>
    </div>
  );
}
