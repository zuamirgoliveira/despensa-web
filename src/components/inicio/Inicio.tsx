"use client";

import Link from "next/link";
import { Alert, Card, EmptyState, LinkBotao } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { lembreteDeBackup } from "@/domain/backup";
import { resumirDia } from "@/domain/inicio";
import { dataRecife, hojeRecife } from "@/lib/datas";
import { dataBR } from "@/lib/format";
import { TIPO_IDA_ROTULO } from "@/lib/rotulos";
import { LembreteBackup } from "./LembreteBackup";

function emDias(n: number): string {
  return n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`;
}

export function Inicio() {
  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const casa = await r.iniciar();
    const [produtos, estoques, compras, agendas, perfil, listas, mercados] = await Promise.all([
      r.produtos.listar(),
      r.estoques.listar(),
      r.compras.listar(),
      r.agendas.listar(),
      r.perfis.obterDaCasa(casa.id),
      r.listas.listar(),
      r.mercados.listar(),
    ]);
    const qrParaBuscar = (await r.notasPendentes.listar()).length;
    const hoje = hojeRecife();
    return {
      ...resumirDia({ hoje, produtos, estoques, compras, agendas, listas, mercados }),
      qrParaBuscar,
      lembreteBackup: lembreteDeBackup({ ultimoBackupEm: perfil?.ultimoBackupEm, compras, hoje }),
    };
  }, ["produtos", "estoques", "compras", "agendas", "perfis", "listas", "mercados", "notasPendentes"]);

  if (carregando || !dados) return <p aria-live="polite">Carregando...</p>;

  const alertaFila =
    dados.qrParaBuscar > 0 ? (
      <Alert tipo="aviso">
        <p>
          {dados.qrParaBuscar === 1 ? "1 nota lida pelo QR está esperando busca." : `${dados.qrParaBuscar} notas lidas pelo QR estão esperando busca.`} Com
          internet, é só tocar para buscar e conferir.
        </p>
        <Link href="/importar" className="mt-2 inline-flex min-h-11 items-center font-medium underline">
          Buscar agora
        </Link>
      </Alert>
    ) : null;

  if (dados.semNada) {
    return (
      <div className="flex flex-col gap-4">
        {alertaFila}
        <EmptyState titulo="Bem-vindo à Despensa" acao={<LinkBotao href="/despensa">Adicionar o primeiro item</LinkBotao>}>
          Cadastre o que você tem em casa, com a quantidade padrão de cada item. O que estiver zerado ou abaixo do padrão vai para a lista de compras. Ou
          atualize tudo de uma vez importando a nota de uma compra.
        </EmptyState>
        <LinkBotao href="/importar" variante="secundario">
          Importar a primeira nota
        </LinkBotao>
      </div>
    );
  }

  const { proxima } = dados;
  return (
    <div className="flex flex-col gap-4">
      {dados.lembreteBackup ? <LembreteBackup lembrete={dados.lembreteBackup} /> : null}

      {alertaFila}

      {dados.notasPendentes.map((l) => (
        <Alert key={l.id} tipo="aviso">
          <p>A compra da lista de {dataBR(dataRecife(l.criadaEm))} está aberta. Importe a nota para fechar a lista e atualizar o estoque.</p>
          <Link href={`/importar?lista=${l.id}`} className="mt-2 inline-flex min-h-11 items-center font-medium underline">
            Importar a nota
          </Link>
        </Alert>
      ))}

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-suave">Sua despensa</p>
        <p className="text-2xl font-semibold" aria-label="Itens faltando">
          {dados.faltando === 0 ? "Nada faltando" : `${dados.faltando} ${dados.faltando === 1 ? "item faltando" : "itens faltando"}`}
        </p>
        <p className="text-sm">
          {dados.itens} {dados.itens === 1 ? "item" : "itens"} na despensa
          {dados.zerados ? ` · ${dados.zerados} ${dados.zerados === 1 ? "zerado" : "zerados"}` : ""}
        </p>
        {dados.eventuaisZerados ? (
          <p className="text-sm text-suave">
            {dados.eventuaisZerados} {dados.eventuaisZerados === 1 ? "item eventual acabou" : "itens eventuais acabaram"} e não{" "}
            {dados.eventuaisZerados === 1 ? "vai" : "vão"} para a lista.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <LinkBotao href="/lista">Ver lista</LinkBotao>
          <LinkBotao href="/despensa" variante="secundario">
            Abrir despensa
          </LinkBotao>
        </div>
      </Card>

      {proxima ? (
        <Card className="flex flex-col gap-1">
          <p className="text-sm text-suave">Próxima compra na agenda</p>
          <p className="font-medium" aria-label="Próxima ida">
            {TIPO_IDA_ROTULO[proxima.tipo]} · {dataBR(proxima.data)} · {emDias(proxima.diasAte)}
          </p>
        </Card>
      ) : null}

      {dados.estimativasPendentes.length ? (
        <Alert tipo="info">
          <p>
            Falta estimar a distância de ida de {dados.estimativasPendentes.map((m) => m.apelido || m.nome).join(", ")}. O custo da ida entra na compra depois
            disso.
          </p>
          <Link href="/mercados" className="mt-2 inline-flex min-h-11 items-center font-medium underline">
            Ver mercados
          </Link>
        </Alert>
      ) : null}

      <LinkBotao href="/importar" variante="secundario">
        Atualizar pela nota
      </LinkBotao>
    </div>
  );
}
