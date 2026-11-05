"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { Alert, Button, Card, Input, Progress } from "@/components/ui";
import { criarRepositorios } from "@/data";
import type { ChaveDecodificada } from "@/domain/nfce/chave";
import { correcoesDeUmDigito, formatCNPJ, decodeKey, onlyDigits, type Correcao } from "@/domain/nfce/chave";
import { dataBR, agruparChave } from "@/lib/format";
import { lerChaveDeImagem } from "@/lib/imagemChave";
import { editarChave } from "@/lib/campoChave";
import { iniciarScanner, type Scanner } from "@/lib/qr";
import type { Candidata } from "@/domain/nfce/chave";

export type ChaveValida = Extract<ChaveDecodificada, { ok: true }>;

type Props = {
  /** Chave válida e de NFC-e, ou null. */
  aoMudarChave: (chave: ChaveValida | null, jaImportadaEm: string | null) => void;
  /** Texto externo (ex.: chave achada no texto colado) para preencher o campo. */
  chaveExterna?: string;
};

type Msg = { texto: string; tipo: "ok" | "erro" | "info" } | null;

export function PassoChave({ aoMudarChave, chaveExterna }: Props) {
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [imgMsg, setImgMsg] = useState<Msg>(null);
  const [camera, setCamera] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [candidatas, setCandidatas] = useState<Candidata[]>([]);
  const [aproximada, setAproximada] = useState<string | null>(null);
  const [correcoes, setCorrecoes] = useState<Correcao[]>([]);
  const dica = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Posição do cursor a restaurar depois que o React regrava o campo (senão ele pula para o fim). */
  const cursorPendente = useRef<{ el: HTMLInputElement; pos: number } | null>(null);

  useLayoutEffect(() => {
    const c = cursorPendente.current;
    if (c && document.activeElement === c.el) c.el.setSelectionRange(c.pos, c.pos);
    cursorPendente.current = null;
  });

  function aoDigitar(e: ChangeEvent<HTMLInputElement>): void {
    const el = e.target;
    const edicao = editarChave(texto, el.value, el.selectionStart ?? el.value.length, (e.nativeEvent as InputEvent).inputType);
    cursorPendente.current = { el, pos: edicao.cursor };
    void validar(edicao.texto);
  }
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<Scanner | null>(null);
  /** Cada abertura de câmera tem um número; fechar invalida o pedido ainda em andamento. */
  const sessao = useRef(0);
  const arqFoto = useRef<HTMLInputElement>(null);
  const arqImagem = useRef<HTMLInputElement>(null);

  async function validar(valor: string): Promise<void> {
    const d = onlyDigits(valor).slice(0, 44);
    setTexto(agruparChave(d));
    aoMudarChave(null, null);
    setCorrecoes([]);
    if (d.length === 0) return setMsg(null);
    if (d.length < 44) return setMsg({ texto: `${d.length}/44 dígitos`, tipo: "info" });
    const k = decodeKey(d);
    if (!k.ok) {
      setCorrecoes(correcoesDeUmDigito(d)); // sugestões de 1 dígito; o usuário confere no papel e escolhe
      return setMsg({ texto: k.error, tipo: "erro" });
    }
    if (!k.ehNFCe) return setMsg({ texto: "Esta chave não é de NFC-e (modelo 65).", tipo: "erro" });
    const repos = await criarRepositorios();
    const ja = await repos.compras.obter(k.chave);
    const base = `Chave válida: nota ${k.numero}, série ${k.serie}, ${k.uf}, ${String(k.mes).padStart(2, "0")}/${k.ano}, CNPJ ${formatCNPJ(k.cnpj)}.`;
    setMsg({ texto: ja ? `${base} Já importada em ${dataBR(ja.importadoEm)}.` : base, tipo: ja ? "erro" : "ok" });
    aoMudarChave(k, ja ? ja.importadoEm : null);
  }

  function usarChave(chave: string, conteudoQR: string | null = null): void {
    const url = conteudoQR && /^https?:\/\//i.test(conteudoQR) ? conteudoQR : null;
    setQrUrl(url);
    setCandidatas([]);
    setAproximada(null);
    void validar(chave);
  }

  useEffect(() => {
    if (chaveExterna) queueMicrotask(() => void validar(chaveExterna));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveExterna]);

  useEffect(
    () => () => {
      sessao.current++;
      scanner.current?.parar();
    },
    [],
  );

  function pararCamera(): void {
    if (dica.current) clearTimeout(dica.current);
    sessao.current++;
    scanner.current?.parar();
    scanner.current = null;
    setCamera(false);
  }

  async function abrirCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return setImgMsg({ texto: 'Este navegador não abre a câmera aqui. Use "Tirar foto" ou digite a chave.', tipo: "erro" });
    }
    const minha = ++sessao.current;
    setCamera(true);
    setImgMsg({ texto: "Aponte para o QR Code da nota.", tipo: "info" });
    // Se em alguns segundos nada for lido, orienta (o QR do papel térmico é pequeno e pede foco e luz).
    if (dica.current) clearTimeout(dica.current);
    dica.current = setTimeout(() => {
      if (sessao.current === minha) {
        setImgMsg({
          texto: 'Ainda não consegui ler o QR. Deixe o papel liso, com boa luz, e aproxime ou afaste devagar até o QR ficar nítido. Se não der, use "Tirar foto" ou digite a chave.',
          tipo: "info",
        });
      }
    }, 8000);
    await new Promise((r) => setTimeout(r, 0)); // espera o <video> existir
    try {
      const novo = await iniciarScanner(video.current as HTMLVideoElement, (r) => {
        if (dica.current) clearTimeout(dica.current);
        scanner.current = null;
        setCamera(false);
        setImgMsg({ texto: "QR Code lido.", tipo: "ok" });
        usarChave(r.chave, r.conteudo);
      });
      if (sessao.current !== minha) novo.parar(); // fechou (ou saiu da tela) antes de a câmera abrir
      else scanner.current = novo;
    } catch {
      if (sessao.current !== minha) return;
      pararCamera();
      setImgMsg({
        texto: 'Não consegui abrir a câmera. Verifique a permissão, ou use "Tirar foto" / "Enviar imagem".',
        tipo: "erro",
      });
    }
  }

  async function processarImagem(arquivo: File | undefined): Promise<void> {
    if (!arquivo) return;
    pararCamera();
    setCandidatas([]);
    setAproximada(null);
    try {
      const repos = await criarRepositorios();
      const cnpjs = (await repos.mercados.listar()).map((m) => m.cnpj);
      const r = await lerChaveDeImagem(arquivo, {
        cnpjsConhecidos: cnpjs,
        aoPrevia: setPrevia,
        aoProgredir: setProgresso,
        aoEtapa: (e) => {
          if (e === "abrindo") setImgMsg({ texto: "Abrindo a imagem...", tipo: "info" });
          if (e === "qr") setImgMsg({ texto: "Procurando QR Code...", tipo: "info" });
          if (e === "ocr") {
            setProgresso(0);
            setImgMsg({ texto: "Lendo os números da nota (leva alguns segundos)...", tipo: "info" });
          }
        },
      });
      if (r.tipo === "qr") {
        setImgMsg({ texto: "QR Code encontrado na imagem.", tipo: "ok" });
        return usarChave(r.chave, r.conteudo);
      }
      const o = r.resultado;
      if ("exata" in o) {
        setImgMsg({ texto: "Li a chave na foto. Confira os números abaixo antes de seguir.", tipo: "ok" });
        usarChave(o.exata);
      } else if ("candidatas" in o) {
        setImgMsg({
          texto: "A foto não ficou perfeita e corrigi dígitos que o leitor confundiu. Escolha a chave que bate com a sua nota:",
          tipo: "erro",
        });
        setCandidatas(o.candidatas);
      } else {
        if (o.aproximada) setAproximada(o.aproximada);
        setImgMsg({
          texto: o.aproximada
            ? "Não consegui ler a chave com certeza (a impressão pontilhada confunde o leitor). Veja a leitura aproximada abaixo, ou tire outra foto bem de perto da linha da chave."
            : o.ambiguo
            ? "Li números demais com dúvida para adivinhar. Tire outra foto, bem de perto da linha da chave e com boa luz, ou digite."
            : "Não encontrei a chave na imagem. Tente de novo com a nota esticada e a linha da chave bem à vista, ou digite.",
          tipo: "erro",
        });
      }
    } catch (e) {
      setImgMsg({ texto: e instanceof Error ? e.message : "Não consegui ler essa imagem.", tipo: "erro" });
    } finally {
      setProgresso(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm">1. Chave da nota</h2>
      <Input
        rotulo="Chave de acesso (44 dígitos)"
        inputMode="numeric"
        autoComplete="off"
        value={texto}
        onChange={aoDigitar}
        placeholder="0000 0000 0000 ..."
      />
      {msg ? <Alert tipo={msg.tipo === "erro" ? "erro" : msg.tipo === "ok" ? "info" : "aviso"}>{msg.texto}</Alert> : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variante="secundario" onClick={() => void abrirCamera()}>
          Escanear QR
        </Button>
        <Button variante="secundario" onClick={() => arqFoto.current?.click()}>
          Tirar foto
        </Button>
        <Button variante="secundario" onClick={() => arqImagem.current?.click()}>
          Enviar imagem
        </Button>
      </div>
      <input
        ref={arqFoto}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Tirar foto da nota"
        onChange={(e) => {
          void processarImagem(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={arqImagem}
        type="file"
        accept="image/*"
        hidden
        aria-label="Enviar imagem da nota"
        onChange={(e) => {
          void processarImagem(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {camera ? (
        <div className="flex flex-col gap-2">
          <video ref={video} playsInline muted className="aspect-square w-full rounded-lg bg-black object-cover" />
          <Button variante="secundario" onClick={pararCamera}>
            Fechar câmera
          </Button>
        </div>
      ) : null}

      {imgMsg ? <Alert tipo={imgMsg.tipo === "erro" ? "erro" : imgMsg.tipo === "ok" ? "info" : "aviso"}>{imgMsg.texto}</Alert> : null}
      {progresso !== null ? <Progress rotulo="Lendo a foto" valor={progresso} maximo={1} /> : null}

      {correcoes.length ? (
        <div className="flex flex-col gap-2" role="group" aria-label="Correções possíveis">
          <p className="text-sm text-suave">
            Se só um dígito estiver errado, estas trocas deixam a chave válida. Confira no papel (o número da nota e a data estão impressos logo abaixo da chave) e escolha a que bate:
          </p>
          <p className="text-xs text-suave">
            Se a chave está idêntica à do papel e nenhuma troca bate, a própria nota saiu com a chave inválida (acontece em notas emitidas em contingência). A SEFAZ também a recusa: peça uma nova via ou a correção ao estabelecimento.
          </p>
          {correcoes.map((c) => (
            <Button key={`${c.posicao}-${c.para}`} variante="secundario" onClick={() => void validar(c.chave)}>
              Grupo {Math.floor((c.posicao - 1) / 4) + 1}, dígito {((c.posicao - 1) % 4) + 1}: trocar {c.de} por {c.para}
            </Button>
          ))}
        </div>
      ) : null}
      {aproximada ? (
        <div className="flex flex-col gap-2" role="group" aria-label="Leitura aproximada">
          <p className="text-sm text-suave">Leitura aproximada (pode ter dígitos errados), ainda não usada:</p>
          <p className="numero flex flex-wrap gap-x-2 gap-y-1 rounded-lg border border-borda-forte bg-fundo p-2 font-mono text-sm">
            {aproximada.split(" ").map((g, i) => (
              <span key={i} className={g.length === 4 ? undefined : "font-bold text-erro underline"}>
                {g}
                {g.length === 4 ? null : <span className="sr-only"> (tem {g.length} dígitos, deveria ter 4)</span>}
              </span>
            ))}
          </p>
          <p className="text-xs text-suave">Grupos sublinhados em vermelho não têm 4 dígitos: o leitor errou ali. Cada grupo da nota tem exatamente 4.</p>
          <Button
            variante="secundario"
            onClick={() => {
              void validar(aproximada);
              setAproximada(null);
              setImgMsg({ texto: "Confira cada grupo com a nota impressa e corrija os dígitos diferentes. O app só segue com a chave válida.", tipo: "info" });
            }}
          >
            Usar para corrigir
          </Button>
        </div>
      ) : null}
      {candidatas.length ? (
        <div className="flex flex-col gap-2" role="group" aria-label="Chaves candidatas">
          {candidatas.map((c) => (
            <Button
              key={c.chave}
              variante="secundario"
              className="h-auto flex-col py-2 font-mono text-sm"
              onClick={() => {
                setImgMsg(null);
                usarChave(c.chave);
              }}
            >
              {agruparChave(c.chave)}
              <span className="font-sans text-xs text-suave">{c.trocas} dígito(s) corrigido(s)</span>
            </Button>
          ))}
        </div>
      ) : null}

      {previa ? (
        // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob/data), sem otimização
        <img src={previa} alt="Prévia da foto da nota" className="max-h-48 w-full rounded-lg object-contain" />
      ) : null}

      {qrUrl ? (
        <Button variante="secundario" onClick={() => window.open(qrUrl, "_blank", "noopener")}>
          Abrir o link do QR (teste sem captcha)
        </Button>
      ) : null}
    </Card>
  );
}
