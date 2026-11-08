"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Input, Select } from "@/components/ui";
import type { ItemConferencia, SituacaoNaDespensa } from "@/data/importarNota";
import { chaveDeProduto, faltaTamanho, formatarTamanho, lerTamanhoDigitado, normalizarDescricao } from "@/domain/normalizacao";
import type { ResultadoParser } from "@/domain/nfce/parser";
import type { Lista } from "@/domain/types";
import { brl, dataBR, horaBR, numeroBR } from "@/lib/format";

type Props = {
  leitura: ResultadoParser;
  avisosExtras: string[];
  errosExtras: string[];
  itens: ItemConferencia[];
  nomes: Record<string, string>;
  aoMudarNome: (codigo: string, nome: string) => void;
  jaImportada: boolean;
  salvando: boolean;
  aoSalvar: () => void;
  listasAbertas: readonly Lista[];
  listaId: string;
  aoMudarLista: (id: string) => void;
  /** O que a despensa já tem de cada nome, para mostrar o efeito da nota. */
  despensa: Record<string, SituacaoNaDespensa>;
  ignorados: ReadonlySet<string>;
  aoAlternarIgnorar: (codigo: string) => void;
  reporSempre: ReadonlySet<string>;
  porUnidade: ReadonlySet<string>;
  aoAlternarPorUnidade: (codigo: string) => void;
  aoAlternarReporSempre: (codigo: string) => void;
};

export function Conferencia({
  leitura,
  avisosExtras,
  errosExtras,
  itens,
  nomes,
  aoMudarNome,
  jaImportada,
  salvando,
  aoSalvar,
  listasAbertas,
  listaId,
  aoMudarLista,
  despensa,
  ignorados,
  aoAlternarIgnorar,
  reporSempre,
  aoAlternarReporSempre,
  porUnidade,
  aoAlternarPorUnidade,
}: Props) {
  const { nota } = leitura;
  const erros = [...leitura.erros, ...errosExtras];
  const avisos = [...leitura.avisos, ...avisosExtras];
  const [tamanhosDigitados, setTamanhosDigitados] = useState<Record<string, string>>({});
  const porCodigo = new Map(nota.itens.map((i) => [i.codigo, i]));

  return (
    <Card className="flex flex-col gap-3" aria-live="polite">
      <h2 className="text-sm">4. Conferir e salvar</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-suave">Mercado</dt>
        <dd className="font-medium">{nota.loja.nome || "?"}</dd>
        <dt className="text-suave">Data</dt>
        <dd className="font-medium">{nota.emissao ? `${dataBR(nota.emissao)} ${horaBR(nota.emissao)}` : "?"}</dd>
        <dt className="text-suave">Itens</dt>
        <dd className="font-medium">{nota.itens.length}</dd>
        <dt className="text-suave">Soma dos itens</dt>
        <dd className="font-medium">{brl(nota.somaItensCentavos)}</dd>
        <dt className="text-suave">Valor pago</dt>
        <dd className="font-medium">{nota.valorPagarCentavos == null ? "?" : brl(nota.valorPagarCentavos)}</dd>
      </dl>

      {erros.map((e) => (
        <Alert key={e} tipo="erro">
          {e}
        </Alert>
      ))}
      {avisos.map((a) => (
        <Alert key={a} tipo="aviso">
          {a}
        </Alert>
      ))}
      {jaImportada ? <Alert tipo="aviso">Esta nota já foi importada. Salvar vai substituir a compra existente.</Alert> : null}

      <ul className="flex flex-col gap-3">
        {itens.map((i) => {
          const it = porCodigo.get(i.codigo);
          const nome = nomes[i.codigo] ?? i.sugestaoNome;
          const naDespensa = despensa[chaveDeProduto(nome)];
          const ignorado = ignorados.has(i.codigo);
          const recorrente = naDespensa?.recorrente ?? false;
          return (
            <li key={i.codigo} className="flex flex-col gap-1 rounded-lg border border-borda p-2">
              <div className="flex items-center justify-between gap-2 text-xs text-suave">
                <span>{i.descricao}</span>
                {i.novo ? <Badge tom="info">novo</Badge> : null}
              </div>
              <Input rotulo="Nome do produto" value={nomes[i.codigo] ?? i.sugestaoNome} onChange={(e) => aoMudarNome(i.codigo, e.target.value)} />
              {i.parecidos.length ? (
                <div className="flex flex-col gap-1" role="group" aria-label={`Produtos parecidos com ${i.sugestaoNome}`}>
                  <p className="text-xs text-suave">Já existe algo parecido no catálogo. É o mesmo produto?</p>
                  {i.parecidos.map((p) => (
                    <Button key={p.nome} variante="secundario" className="justify-start text-left" onClick={() => aoMudarNome(i.codigo, p.nome)}>
                      Usar “{p.nome}”{p.motivo === "tamanho" ? " (outro tamanho)" : ""}
                    </Button>
                  ))}
                </div>
              ) : null}
              {it && !ignorado && (faltaTamanho(it.unidade, nome) || tamanhosDigitados[i.codigo]) && !naDespensa?.porUnidade ? (
                <TamanhoDoItem
                  nomeBase={i.sugestaoNome}
                  sugestoes={i.parecidos.flatMap((p) => {
                    const t = normalizarDescricao(p.nome).tamanho;
                    return p.motivo === "tamanho" && t ? [formatarTamanho(t)] : [];
                  })}
                  porUnidade={porUnidade.has(i.codigo)}
                  aoMudarTamanho={(texto) => {
                    setTamanhosDigitados((a) => ({ ...a, [i.codigo]: texto }));
                    const t = lerTamanhoDigitado(texto);
                    aoMudarNome(i.codigo, t ? `${normalizarDescricao(i.sugestaoNome).nome} ${formatarTamanho(t)}` : i.sugestaoNome);
                  }}
                  aoAlternarPorUnidade={() => aoAlternarPorUnidade(i.codigo)}
                />
              ) : null}
              {it ? (
                <p className="text-xs text-suave">
                  {numeroBR(it.quantidade)} {it.unidade.toLowerCase()} × {brl(it.valorUnitarioCentavos)} = {brl(it.valorTotalCentavos)}
                </p>
              ) : null}
              {it ? (
                <p className="text-sm" data-testid="efeito-despensa">
                  {ignorado
                    ? "Fora da despensa: só fica no histórico da nota."
                    : naDespensa?.atual !== undefined
                      ? `Despensa: ${numeroBR(naDespensa.atual)} → ${numeroBR(Math.round((naDespensa.atual + it.quantidade) * 1000) / 1000)} (+${numeroBR(it.quantidade)})`
                      : `Entra na despensa com ${numeroBR(it.quantidade)}.`}
                </p>
              ) : null}
              {!ignorado && !recorrente ? (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5" checked={reporSempre.has(i.codigo)} onChange={() => aoAlternarReporSempre(i.codigo)} />
                  Repor sempre (uso contínuo)
                </label>
              ) : null}
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="size-5" checked={ignorado} onChange={() => aoAlternarIgnorar(i.codigo)} />
                Não é da despensa (sacola, serviço)
              </label>
            </li>
          );
        })}
      </ul>

      <p className="text-sm" aria-label="Vínculo com a lista">
        {listaId && listasAbertas.some((l) => l.id === listaId)
          ? `Esta nota será ligada à lista de ${dataBR(listasAbertas.find((l) => l.id === listaId)!.data)} e vai fechá-la.`
          : "Esta nota não está ligada a nenhuma lista: só soma à despensa e guarda os preços."}
      </p>
      {listasAbertas.length ? (
        <Select
          rotulo="Associar esta nota à lista"
          value={listaId}
          onChange={(e) => aoMudarLista(e.target.value)}
          ajuda="A lista é conferida com a nota (comprado, faltou, fora da lista) e fechada ao salvar."
        >
          <option value="">Nenhuma (só importar)</option>
          {listasAbertas.map((l) => (
            <option key={l.id} value={l.id}>
              Lista de {dataBR(l.data)}
            </option>
          ))}
        </Select>
      ) : null}

      <Button disabled={erros.length > 0 || salvando} onClick={aoSalvar}>
        {jaImportada ? "Substituir compra" : "Salvar compra"}
      </Button>
    </Card>
  );
}

function TamanhoDoItem({
  nomeBase,
  sugestoes,
  porUnidade,
  aoMudarTamanho,
  aoAlternarPorUnidade,
}: {
  nomeBase: string;
  sugestoes: string[];
  porUnidade: boolean;
  aoMudarTamanho: (texto: string) => void;
  aoAlternarPorUnidade: () => void;
}) {
  const [texto, setTexto] = useState("");
  const invalido = texto.trim() !== "" && lerTamanhoDigitado(texto) === undefined;
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-aviso/10 p-2" role="group" aria-label={`Tamanho de ${nomeBase}`}>
      <p className="text-xs">A nota não diz o tamanho da embalagem. Informe para comparar preços certo (Coca 2l não é Coca 350ml).</p>
      {!porUnidade ? (
        <>
          <Input
            rotulo="Tamanho da embalagem (ex.: 2l, 350ml, 200g)"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              aoMudarTamanho(e.target.value);
            }}
            erro={invalido ? "Use um número com g, kg, ml ou l." : undefined}
          />
          {sugestoes.length ? (
            <div className="flex flex-wrap gap-2">
              {sugestoes.map((t) => (
                <Button
                  key={t}
                  variante="secundario"
                  onClick={() => {
                    setTexto(t);
                    aoMudarTamanho(t);
                  }}
                >
                  {t}
                </Button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-5" checked={porUnidade} onChange={aoAlternarPorUnidade} />
        Vendido por unidade (sem tamanho, como ovo ou pizza)
      </label>
    </div>
  );
}
