"use client";

import { useRef, useState } from "react";
import { Alert, Button, Card, Dialog, LinkBotao, useToast } from "@/components/ui";
import {
  BackupInvalidoError,
  compararComAparelho,
  criarRepositorios,
  inspecionarBackup,
  restaurarBackup,
  type ComparacaoAparelho,
  type InspecaoBackup,
  type ModoRestauracao,
} from "@/data";
import { dataBR, instanteBR } from "@/lib/format";
import { descreverContagens, guardarCopiaNoNavegador } from "./copiaNavegador";

type Conferencia = { json: string; inspecao: InspecaoBackup; comparacao: ComparacaoAparelho; arquivo: string };
type Passo = "conferencia" | "confirmar" | "confirmar-substituir";

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

/** Restaurar ou apenas verificar uma cópia de segurança (docs/backup.md seção 4). Nada é gravado antes da confirmação. */
export function RestaurarBackup() {
  const { mostrar } = useToast();
  const campo = useRef<HTMLInputElement>(null);
  const [conf, setConf] = useState<Conferencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [modo, setModo] = useState<ModoRestauracao | null>(null);
  const [passo, setPasso] = useState<Passo>("conferencia");
  const [entendi, setEntendi] = useState(false);
  const [segurancaFeita, setSegurancaFeita] = useState(false);

  function fechar(): void {
    setConf(null);
    setModo(null);
    setPasso("conferencia");
    setEntendi(false);
    setSegurancaFeita(false);
  }

  async function abrir(f: File | undefined): Promise<void> {
    if (!f) return;
    setErro(null);
    setPronto(null);
    fechar();
    try {
      const json = await f.text();
      const inspecao = await inspecionarBackup(json); // não grava nada
      const comparacao = await compararComAparelho(await criarRepositorios(), inspecao);
      setConf({ json, inspecao, comparacao, arquivo: f.name });
    } catch (e) {
      setErro(e instanceof BackupInvalidoError ? e.message : "Não consegui ler esse arquivo.");
    }
  }

  async function aplicar(m: ModoRestauracao): Promise<void> {
    if (!conf) return;
    setOcupado(true);
    try {
      const resumo = await restaurarBackup(await criarRepositorios(), conf.json, m);
      setPronto(`Restaurado: ${descreverContagens(resumo)}.${conf.inspecao.temPosicaoDeCasa ? "" : " Falta informar a posição de casa (Ajustes → Localização da casa)."}`);
      mostrar("Cópia restaurada.");
      fechar();
    } catch (e) {
      setPasso("conferencia");
      setErro(
        e instanceof BackupInvalidoError
          ? e.message
          : "Não consegui restaurar essa cópia. Nada foi alterado neste aparelho. Tente de novo ou faça uma nova cópia no outro aparelho.",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function guardarSeguranca(): Promise<void> {
    try {
      const r = await guardarCopiaNoNavegador();
      if (r.via !== "cancelado") setSegurancaFeita(true);
    } catch {
      mostrar("Não consegui guardar a cópia de segurança.", "erro");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variante="secundario" onClick={() => campo.current?.click()}>
        Restaurar ou verificar uma cópia
      </Button>
      <input
        ref={campo}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="Arquivo de backup"
        onChange={(e) => {
          void abrir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {erro ? <Alert tipo="erro">{erro}</Alert> : null}
      {pronto ? (
        <Alert tipo="sucesso">
          <p>{pronto}</p>
          <LinkBotao href="/" variante="secundario" className="mt-2">
            Ir para o Início
          </LinkBotao>
        </Alert>
      ) : null}

      {conf ? <ConferenciaDaCopia conf={conf} aoFechar={fechar} aoRestaurarDireto={() => void aplicar("mesclar")} aoEscolher={(m) => { setModo(m); setPasso("confirmar"); }} ocupado={ocupado} /> : null}

      {conf && modo ? (
        <>
          <Dialog
            aberto={passo === "confirmar"}
            titulo={modo === "mesclar" ? "Mesclar a cópia com este aparelho?" : "Substituir tudo deste aparelho?"}
            rotuloConfirmar={modo === "mesclar" ? "Mesclar" : "Continuar"}
            perigo={modo === "substituir"}
            aoConfirmar={() => (modo === "mesclar" ? void aplicar("mesclar") : setPasso("confirmar-substituir"))}
            aoCancelar={() => {
              setPasso("conferencia");
              setModo(null);
            }}
          >
            <ExplicacaoDoModo modo={modo} conf={conf} />
          </Dialog>

          <Dialog
            aberto={passo === "confirmar-substituir"}
            titulo="Última confirmação"
            rotuloConfirmar="Apagar e restaurar"
            perigo
            confirmarDesabilitado={!entendi || ocupado}
            aoConfirmar={() => void aplicar("substituir")}
            aoCancelar={() => {
              setPasso("conferencia");
              setModo(null);
              setEntendi(false);
            }}
          >
            <div className="flex flex-col gap-3">
              <Alert tipo="erro">
                Isto apaga {plural(conf.comparacao.contagens.compras, "compra", "compras")}, {plural(conf.comparacao.contagens.produtos, "produto", "produtos")} e{" "}
                {plural(conf.comparacao.contagens.mercados, "mercado", "mercados")} deste aparelho e não tem volta.
              </Alert>
              <Button variante="secundario" onClick={() => void guardarSeguranca()}>
                Guardar uma cópia do que está aqui agora
              </Button>
              {segurancaFeita ? <p className="text-sm text-sucesso">Cópia de segurança guardada.</p> : <p className="text-sm text-suave">Recomendado antes de apagar.</p>}
              <label className="flex min-h-11 items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-5" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} />
                Entendi que isto apaga os dados deste aparelho.
              </label>
            </div>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

function ExplicacaoDoModo({ modo, conf }: { modo: ModoRestauracao; conf: Conferencia }) {
  const { comparacao: c, inspecao } = conf;
  if (modo === "mesclar") {
    return (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Serão copiadas {plural(c.compras.soNaCopia, "compra nova", "compras novas")} e {plural(c.produtos.soNaCopia, "produto novo", "produtos novos")} da cópia.
        </li>
        <li>
          O que existe aqui e na cópia ({plural(c.compras.nosDois, "compra", "compras")}, {plural(c.produtos.nosDois, "produto", "produtos")}) <strong>fica como na cópia</strong>, inclusive níveis de estoque e ajustes.
        </li>
        <li>
          O que só existe neste aparelho ({plural(c.compras.soAqui, "compra", "compras")}, {plural(c.produtos.soAqui, "produto", "produtos")}) <strong>é mantido</strong>.
        </li>
      </ul>
    );
  }
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>
        <strong>Tudo</strong> o que está neste aparelho será apagado ({plural(c.contagens.compras, "compra", "compras")}, {plural(c.contagens.produtos, "produto", "produtos")}, {plural(c.contagens.mercados, "mercado", "mercados")}).
      </li>
      <li>
        No lugar entra a cópia de {instanteBR(inspecao.exportadoEm)}: {descreverContagens(inspecao.contagens)}.
      </li>
      <li>O que só existe aqui ({plural(c.compras.soAqui, "compra", "compras")}) será perdido.</li>
    </ul>
  );
}

function ConferenciaDaCopia({
  conf,
  aoFechar,
  aoRestaurarDireto,
  aoEscolher,
  ocupado,
}: {
  conf: Conferencia;
  aoFechar: () => void;
  aoRestaurarDireto: () => void;
  aoEscolher: (m: ModoRestauracao) => void;
  ocupado: boolean;
}) {
  const { inspecao, comparacao: c } = conf;
  const bloqueada = inspecao.integridade === "falhou";
  return (
    <Card className="flex flex-col gap-3" aria-label="Conferir a cópia">
      <p className="font-semibold">Conferir a cópia</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-suave">Arquivo</dt>
        <dd className="break-all font-medium">{conf.arquivo}</dd>
        <dt className="text-suave">Feita em</dt>
        <dd className="font-medium">{instanteBR(inspecao.exportadoEm)}</dd>
        <dt className="text-suave">Conteúdo</dt>
        <dd className="font-medium">{descreverContagens(inspecao.contagens)}</dd>
        {inspecao.periodo ? (
          <>
            <dt className="text-suave">Compras de</dt>
            <dd className="font-medium">
              {dataBR(inspecao.periodo.de)} a {dataBR(inspecao.periodo.ate)}
            </dd>
          </>
        ) : null}
        {!c.vazio ? (
          <>
            <dt className="text-suave">Neste aparelho</dt>
            <dd className="font-medium">{descreverContagens(c.contagens)}</dd>
          </>
        ) : null}
      </dl>

      {bloqueada ? (
        <Alert tipo="erro">O arquivo está incompleto ou foi alterado depois de gerado. Não dá para restaurá-lo: faça uma nova cópia de segurança.</Alert>
      ) : inspecao.integridade === "ok" ? (
        <Alert tipo="sucesso">Arquivo íntegro e compatível com esta versão do app.</Alert>
      ) : (
        <Alert tipo="info">Arquivo de uma versão antiga do app: não tem soma de verificação, mas o conteúdo foi lido e validado.</Alert>
      )}
      {!bloqueada && !inspecao.temPosicaoDeCasa ? <Alert tipo="aviso">A cópia não tem a posição de casa. Depois de restaurar, será preciso informá-la de novo em Ajustes.</Alert> : null}
      {!bloqueada && c.copiaMaisAntiga ? (
        <Alert tipo="aviso">Esta cópia é mais antiga que a última compra importada neste aparelho. Restaurar pode fazer você perder compras recentes.</Alert>
      ) : null}
      {!bloqueada && c.outraCasa ? <Alert tipo="aviso">Esta cópia é de outra casa. Mesclar deixaria as duas casas no aparelho; para ficar só com a da cópia, use “Substituir tudo”.</Alert> : null}

      {bloqueada ? null : c.vazio ? (
        <Button disabled={ocupado} onClick={aoRestaurarDireto}>
          Restaurar
        </Button>
      ) : (
        <div className="flex flex-col gap-2" role="group" aria-label="O que fazer com o que já está neste aparelho">
          <p className="text-sm font-medium">Este aparelho já tem dados. O que fazer com eles?</p>
          <Button variante="secundario" className="h-auto flex-col items-start gap-1 py-3 text-left" disabled={ocupado} onClick={() => aoEscolher("mesclar")}>
            <span>Mesclar</span>
            <span className="text-sm font-normal text-suave">Junta a cópia com o que há aqui. O que existe nos dois fica como na cópia; o que só existe aqui é mantido.</span>
          </Button>
          <Button variante="secundario" className="h-auto flex-col items-start gap-1 py-3 text-left" disabled={ocupado} onClick={() => aoEscolher("substituir")}>
            <span>Substituir tudo</span>
            <span className="text-sm font-normal text-suave">Apaga tudo o que está neste aparelho e deixa igual à cópia.</span>
          </Button>
        </div>
      )}
      <Button variante="secundario" onClick={aoFechar}>
        Fechar sem restaurar
      </Button>
    </Card>
  );
}
