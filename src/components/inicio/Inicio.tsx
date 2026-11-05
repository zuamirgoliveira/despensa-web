"use client";

import Link from "next/link";
import { Alert, Card, EmptyState, LinkBotao } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { lembreteDeBackup } from "@/domain/backup";
import { resumirDia } from "@/domain/inicio";
import { hojeRecife } from "@/lib/datas";
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
      r.produtos.listar(), r.estoques.listar(), r.compras.listar(), r.agendas.listar(), r.perfis.obterDaCasa(casa.id), r.listas.listar(), r.mercados.listar(),
    ]);
    const hoje = hojeRecife();
    return {
      ...resumirDia({ hoje, produtos, estoques, compras, agendas, folgaDias: perfil?.folgaDias ?? 2, listas, mercados }),
      lembreteBackup: lembreteDeBackup({ ultimoBackupEm: perfil?.ultimoBackupEm, compras, hoje }),
    };
  }, ["produtos", "estoques", "compras", "agendas", "perfis", "listas", "mercados"]);

  if (carregando || !dados) return <p aria-live="polite">Carregando...</p>;

  if (dados.semNotas) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          titulo="Bem-vindo à Despensa"
          acao={
            <LinkBotao href="/importar">
              Importar a primeira nota
            </LinkBotao>
          }
       >
          Importe a nota de uma compra e o app aprende o que você costuma comprar. Depois ele monta a lista de cada ida.
        </EmptyState>
        <LinkBotao href="/ajustes" variante="secundario">
          Ajustar agenda e custos
        </LinkBotao>
      </div>
    );
  }

  const { proxima } = dados;
  return (
    <div className="flex flex-col gap-4">
      {dados.lembreteBackup ? <LembreteBackup lembrete={dados.lembreteBackup} /> : null}

      {dados.notasPendentes.map((l) => (
        <Alert key={l.id} tipo="aviso">
          <p>
            A compra da lista de {dataBR(l.data)} ({TIPO_IDA_ROTULO[l.tipoIda]}) está aberta. Importe a nota para fechar a lista e atualizar o estoque.
          </p>
          <Link href={`/importar?lista=${l.id}`} className="mt-2 inline-flex min-h-11 items-center font-medium underline">
            Importar a nota
          </Link>
        </Alert>
      ))}

      {proxima ? (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-suave">Próxima ida</p>
          <p className="text-2xl font-semibold">{TIPO_IDA_ROTULO[proxima.tipo]}</p>
          <p aria-label="Data da próxima ida">
            {dataBR(proxima.data)} · {emDias(proxima.diasAte)}
          </p>
          <p aria-label="Produtos que vencem">
            {dados.quantosVencem === 0
              ? "Nenhum produto precisa entrar na lista por enquanto."
              : `${dados.quantosVencem} ${dados.quantosVencem === 1 ? "produto vence" : "produtos vencem"} nesta ida.`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <LinkBotao href={`/conferencia?ida=${proxima.tipo}`}>
              Conferir despensa
            </LinkBotao>
            <LinkBotao href={`/lista?ida=${proxima.tipo}`} variante="secundario">
              Ver lista
            </LinkBotao>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-2">
          <p>Nenhuma agenda de ida configurada.</p>
          <LinkBotao href="/ajustes" variante="secundario">
            Definir a agenda
          </LinkBotao>
        </Card>
      )}

      {dados.estimativasPendentes.length ? (
        <Alert tipo="info">
          <p>
            Falta estimar a distância de ida de {dados.estimativasPendentes.map((m) => m.apelido || m.nome).join(", ")}. O custo da ida entra na
            compra depois disso.
          </p>
          <Link href="/mercados" className="mt-2 inline-flex min-h-11 items-center font-medium underline">
            Ver mercados
          </Link>
        </Alert>
      ) : null}

      <LinkBotao href="/importar" variante="secundario">
        Importar nota
      </LinkBotao>
    </div>
  );
}
