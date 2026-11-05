"use client";

import { Alert, Badge, Button, Card, Input, Select } from "@/components/ui";
import type { ItemConferencia } from "@/data/importarNota";
import type { ResultadoParser } from "@/domain/nfce/parser";
import type { Lista } from "@/domain/types";
import { TIPO_IDA_ROTULO } from "@/lib/rotulos";
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
};

export function Conferencia({ leitura, avisosExtras, errosExtras, itens, nomes, aoMudarNome, jaImportada, salvando, aoSalvar, listasAbertas, listaId, aoMudarLista }: Props) {
  const { nota } = leitura;
  const erros = [...leitura.erros, ...errosExtras];
  const avisos = [...leitura.avisos, ...avisosExtras];
  const porCodigo = new Map(nota.itens.map((i) => [i.codigo, i]));

  return (
    <Card className="flex flex-col gap-3" aria-live="polite">
      <h2 className="text-lg font-semibold">4. Conferir e salvar</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-texto/70">Mercado</dt>
        <dd className="font-medium">{nota.loja.nome || "?"}</dd>
        <dt className="text-texto/70">Data</dt>
        <dd className="font-medium">{nota.emissao ? `${dataBR(nota.emissao)} ${horaBR(nota.emissao)}` : "?"}</dd>
        <dt className="text-texto/70">Itens</dt>
        <dd className="font-medium">{nota.itens.length}</dd>
        <dt className="text-texto/70">Soma dos itens</dt>
        <dd className="font-medium">{brl(nota.somaItensCentavos)}</dd>
        <dt className="text-texto/70">Valor pago</dt>
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
          return (
            <li key={i.codigo} className="flex flex-col gap-1 rounded-lg border border-borda p-2">
              <div className="flex items-center justify-between gap-2 text-xs text-texto/70">
                <span>{i.descricao}</span>
                {i.novo ? <Badge tom="verde">novo</Badge> : null}
              </div>
              <Input
                rotulo="Nome do produto"
                value={nomes[i.codigo] ?? i.sugestaoNome}
                onChange={(e) => aoMudarNome(i.codigo, e.target.value)}
              />
              {it ? (
                <p className="text-xs text-texto/70">
                  {numeroBR(it.quantidade)} {it.unidade.toLowerCase()} × {brl(it.valorUnitarioCentavos)} = {brl(it.valorTotalCentavos)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

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
              {TIPO_IDA_ROTULO[l.tipoIda]} · {dataBR(l.data)}
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
