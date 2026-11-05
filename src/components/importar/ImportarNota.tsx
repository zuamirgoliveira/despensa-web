"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { prepararConferencia, salvarNotaImportada, type ItemConferencia } from "@/data/importarNota";
import { finalizarCompra, listasEmCompra } from "@/data/reconciliacao";
import type { Lista } from "@/domain/types";
import { parseNota, type ResultadoParser } from "@/domain/nfce/parser";
import { Conferencia } from "./Conferencia";
import { PassoChave, type ChaveValida } from "./PassoChave";
import { PassoColar } from "./PassoColar";
import { PassoSefaz } from "./PassoSefaz";

type Leitura = { resultado: ResultadoParser; itens: ItemConferencia[]; avisos: string[]; erros: string[] };

export function ImportarNota() {
  const router = useRouter();
  const { mostrar } = useToast();
  const [chave, setChave] = useState<ChaveValida | null>(null);
  const [jaImportadaEm, setJaImportadaEm] = useState<string | null>(null);
  const [chaveExterna, setChaveExterna] = useState<string>();
  const [texto, setTexto] = useState("");
  const [msgLeitura, setMsgLeitura] = useState<{ texto: string; tipo: "ok" | "erro" } | null>(null);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [listasAbertas, setListasAbertas] = useState<Lista[]>([]);
  const [listaId, setListaId] = useState("");
  const [jaImportadaNota, setJaImportadaNota] = useState(false);

  async function ler(conteudo: string, informada: ChaveValida | null): Promise<void> {
    if (!conteudo.trim()) {
      setMsgLeitura({ texto: "Cole o texto da nota primeiro.", tipo: "erro" });
      return;
    }
    const resultado = parseNota(conteudo);
    const { nota } = resultado;
    const avisos: string[] = [];
    const erros: string[] = [];
    if (informada && nota.chave && informada.chave !== nota.chave) {
      erros.push("A chave do texto colado é diferente da chave do passo 1. Você colou a nota certa?");
    }
    if (!informada && nota.chave) setChaveExterna(nota.chave);
    if (!informada && !nota.chave) erros.push("Informe a chave da nota no passo 1.");
    if (nota.cpfNaNota) avisos.push("A nota parece ter CPF. O app não guarda o CPF, só itens e preços.");

    const repos = await criarRepositorios();
    const itens = nota.itens.length ? await prepararConferencia(repos, nota) : [];
    const chaveDaNota = informada?.chave ?? nota.chave;
    setJaImportadaNota(chaveDaNota ? Boolean(await repos.compras.obter(chaveDaNota)) : false);
    setNomes(Object.fromEntries(itens.map((i) => [i.codigo, i.sugestaoNome])));
    setLeitura({ resultado, itens, avisos, erros });
    const temErro = resultado.erros.length + erros.length > 0;
    setMsgLeitura({ texto: temErro ? "Encontrei problemas." : `Li ${nota.itens.length} itens.`, tipo: temErro ? "erro" : "ok" });
  }

  // Listas em compra: a do parâmetro ?lista= (vindo do modo compra) ou, sem ela, a mais recente.
  useEffect(() => {
    (async () => {
      const abertas = await listasEmCompra(await criarRepositorios());
      const pedida = new URLSearchParams(location.search).get("lista");
      setListasAbertas(abertas);
      setListaId(abertas.find((l) => l.id === pedida)?.id ?? abertas[0]?.id ?? "");
    })();
  }, []);

  // Compartilhar (Android): /importar?text=... lê a nota na hora e limpa a URL.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const recebido = [p.get("text"), p.get("url"), p.get("title")].filter(Boolean).join("\n");
    if (!recebido) return;
    history.replaceState(null, "", "/importar");
    queueMicrotask(() => {
      setTexto(recebido);
      void ler(recebido, null);
    });
  }, []);

  async function salvar(): Promise<void> {
    if (!leitura) return;
    const k = chave?.chave ?? leitura.resultado.nota.chave;
    if (!k) return;
    setSalvando(true);
    try {
      const repos = await criarRepositorios();
      const { compra } = await salvarNotaImportada(repos, {
        nota: leitura.resultado.nota,
        chave: k,
        nomes,
        substituir: jaImportadaNota || jaImportadaEm !== null,
      });
      const fechamento = await finalizarCompra(repos, compra, listaId || undefined);
      mostrar("Compra salva.");
      router.push(fechamento.lista ? `/resumo?lista=${fechamento.lista.id}` : "/compras");
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Não consegui salvar a compra.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PassoChave
        aoMudarChave={(c, em) => {
          setChave(c);
          setJaImportadaEm(em);
        }}
        chaveExterna={chaveExterna}
      />
      <PassoSefaz chave={chave} />
      <PassoColar texto={texto} aoMudarTexto={setTexto} aoLer={() => void ler(texto, chave)} mensagem={msgLeitura} />
      {leitura ? (
        <Conferencia
          leitura={leitura.resultado}
          avisosExtras={leitura.avisos}
          errosExtras={leitura.erros}
          itens={leitura.itens}
          nomes={nomes}
          aoMudarNome={(codigo, nome) => setNomes((n) => ({ ...n, [codigo]: nome }))}
          jaImportada={jaImportadaNota || jaImportadaEm !== null}
          salvando={salvando}
          aoSalvar={() => void salvar()}
          listasAbertas={listasAbertas}
          listaId={listaId}
          aoMudarLista={setListaId}
        />
      ) : null}
      <Alert tipo="info">Seus dados ficam só neste aparelho. O app não guarda CPF.</Alert>
    </div>
  );
}
