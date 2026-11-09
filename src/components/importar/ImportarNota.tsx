"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { prepararConferencia, salvarNotaImportada, situacaoDosProdutos, type ItemConferencia, type SituacaoNaDespensa } from "@/data/importarNota";
import { finalizarCompra, listasEmCompra } from "@/data/reconciliacao";
import type { Lista } from "@/domain/types";
import { parseNota, type ResultadoParser } from "@/domain/nfce/parser";
import { consultaDoQR } from "@/domain/nfce/sefaz";
import { BuscaNotaError, buscarNotaPeloQR } from "@/lib/nfceRemota";
import { Conferencia } from "./Conferencia";
import { EstimativaIda } from "./EstimativaIda";
import { PassoChave, type ChaveValida } from "./PassoChave";
import { PassoColar } from "./PassoColar";
import { PassoSefaz } from "./PassoSefaz";

type Leitura = { resultado: ResultadoParser; itens: ItemConferencia[]; avisos: string[]; erros: string[] };

function alternar(conjunto: ReadonlySet<string>, codigo: string): ReadonlySet<string> {
  const novo = new Set(conjunto);
  if (!novo.delete(codigo)) novo.add(codigo);
  return novo;
}

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
  const [despensa, setDespensa] = useState<Record<string, SituacaoNaDespensa>>({});
  const [ignorados, setIgnorados] = useState<ReadonlySet<string>>(new Set());
  const [reporSempre, setReporSempre] = useState<ReadonlySet<string>>(new Set());
  const [porUnidade, setPorUnidade] = useState<ReadonlySet<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [listasAbertas, setListasAbertas] = useState<Lista[]>([]);
  const [listaId, setListaId] = useState("");
  const [estimar, setEstimar] = useState<{ mercadoId: string; chave: string; destino: string } | null>(null);
  const [jaImportadaNota, setJaImportadaNota] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [msgBusca, setMsgBusca] = useState<{ texto: string; tipo: "ok" | "erro" } | null>(null);

  async function ler(conteudo: string, informada: ChaveValida | null): Promise<void> {
    if (!conteudo.trim()) {
      setMsgLeitura({ texto: "Cole o texto da nota primeiro.", tipo: "erro" });
      return;
    }
    await aplicarResultado(parseNota(conteudo), informada);
  }

  /** Busca a nota pela URL do QR (servidor repassa a consulta pública) e segue para a conferência. */
  async function buscarPeloQR(url: string): Promise<void> {
    const consulta = consultaDoQR(url);
    if (!consulta) return;
    setBuscando(true);
    setMsgBusca(null);
    try {
      const resultado = await buscarNotaPeloQR(consulta.url);
      await aplicarResultado(resultado, null);
      setMsgBusca({ texto: "Nota buscada na SEFAZ. Confira os itens abaixo e salve.", tipo: "ok" });
    } catch (e) {
      setMsgBusca({
        texto: `${e instanceof BuscaNotaError ? e.message : "Não consegui buscar a nota."} Use o passo a passo abaixo.`,
        tipo: "erro",
      });
    } finally {
      setBuscando(false);
    }
  }

  async function aplicarResultado(resultado: ResultadoParser, informada: ChaveValida | null): Promise<void> {
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
    setDespensa(await situacaoDosProdutos(repos));
    setIgnorados(new Set());
    setReporSempre(new Set());
    setPorUnidade(new Set());
    setLeitura({ resultado, itens, avisos, erros });
    const temErro = resultado.erros.length + erros.length > 0;
    setMsgLeitura({ texto: temErro ? "Encontrei problemas." : `Li ${nota.itens.length} itens.`, tipo: temErro ? "erro" : "ok" });
  }

  // Vínculo com lista só quando a importação vem do botão do Modo compra (?lista=). Sem ele, nenhuma lista
  // vem marcada: comprar fora da lista não pode fechar nem reconciliar uma lista por engano.
  useEffect(() => {
    (async () => {
      const abertas = await listasEmCompra(await criarRepositorios());
      const pedida = new URLSearchParams(location.search).get("lista");
      setListasAbertas(abertas);
      setListaId(abertas.find((l) => l.id === pedida)?.id ?? "");
    })();
  }, []);

  // Compartilhar (Android): /importar?text=... lê a nota na hora e limpa a URL.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const recebido = [p.get("text"), p.get("url"), p.get("title")].filter(Boolean).join("\n");
    if (!recebido) return;
    history.replaceState(null, "", "/importar");
    // QR lido pela câmera do celular e compartilhado com o app: a URL basta para buscar a nota
    const url = recebido.match(/https:\/\/nfce\.sefaz\.pe\.gov\.br\S*/)?.[0];
    const consulta = url ? consultaDoQR(url) : null;
    queueMicrotask(() => {
      if (consulta) {
        setChaveExterna(consulta.chave);
        void buscarPeloQR(consulta.url);
        return;
      }
      setTexto(recebido);
      void ler(recebido, null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(): Promise<void> {
    if (!leitura) return;
    const k = chave?.chave ?? leitura.resultado.nota.chave;
    if (!k) return;
    setSalvando(true);
    try {
      const repos = await criarRepositorios();
      const anterior = await repos.compras.obter(k);
      const { compra, mercado } = await salvarNotaImportada(repos, {
        nota: leitura.resultado.nota,
        chave: k,
        nomes,
        substituir: jaImportadaNota || jaImportadaEm !== null,
        ignorar: [...ignorados],
        reporSempre: [...reporSempre],
        porUnidade: [...porUnidade],
      });
      const fechamento = await finalizarCompra(repos, compra, listaId || undefined, new Date(), anterior);
      mostrar("Compra salva.");
      const destino = fechamento.lista ? `/resumo?lista=${fechamento.lista.id}` : "/compras";
      // sempre pergunta como a pessoa foi (carro, bike ou a pé); "Decidir depois" nunca bloqueia
      setEstimar({ mercadoId: mercado.id, chave: compra.chave, destino });
    } catch (e) {
      mostrar(e instanceof Error ? e.message : "Não consegui salvar a compra.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  if (estimar) return <EstimativaIda mercadoId={estimar.mercadoId} chave={estimar.chave} aoConcluir={() => router.push(estimar.destino)} />;

  return (
    <div className="flex flex-col gap-4">
      <PassoChave
        aoMudarChave={(c, em) => {
          setChave(c);
          setJaImportadaEm(em);
        }}
        aoLerQr={(url) => {
          setMsgBusca(null);
          if (url && consultaDoQR(url)) void buscarPeloQR(url);
        }}
        chaveExterna={chaveExterna}
      />
      {buscando ? <Alert tipo="info">Buscando a nota na SEFAZ...</Alert> : null}
      {msgBusca ? <Alert tipo={msgBusca.tipo === "ok" ? "info" : "erro"}>{msgBusca.texto}</Alert> : null}
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
          despensa={despensa}
          ignorados={ignorados}
          aoAlternarIgnorar={(c) => setIgnorados((a) => alternar(a, c))}
          reporSempre={reporSempre}
          aoAlternarReporSempre={(c) => setReporSempre((a) => alternar(a, c))}
          porUnidade={porUnidade}
          aoAlternarPorUnidade={(c) => setPorUnidade((a) => alternar(a, c))}
        />
      ) : null}
      <Alert tipo="info">Seus dados ficam só neste aparelho. O app não guarda CPF.</Alert>
    </div>
  );
}
