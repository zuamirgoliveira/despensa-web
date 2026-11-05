"use client";

import Link from "next/link";
import { Alert, Card, EmptyState } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { mesAnterior, metricasDoMes, painelTemDados, tendencia, type MetricasDoMes, type Tendencia } from "@/domain/painel";
import { hojeRecife } from "@/lib/datas";
import { brl } from "@/lib/format";
import { TIPO_IDA_ROTULO } from "@/lib/rotulos";

const SETA: Record<Tendencia, string> = { melhorou: "▼", piorou: "▲", igual: "=", sem_dados: "" };
type Def = {
  chave: string;
  rotulo: string;
  melhorQuando: "menor" | "maior";
  valor: (m: MetricasDoMes) => number | undefined;
  formatar: (v: number) => string;
  texto: (atual: number | undefined, t: Tendencia) => string;
};

const min = (s: number): string => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

const DEFS: Def[] = [
  { chave: "idas", rotulo: "Idas ao mercado", melhorQuando: "menor", valor: (m) => m.idas, formatar: String,
    texto: (_a, t) => (t === "melhorou" ? "Menos idas que no mês passado: é o objetivo." : t === "piorou" ? "Mais idas que no mês passado." : "Mesmo número de idas do mês passado.") },
  { chave: "emergencias", rotulo: "Compras de emergência", melhorQuando: "menor", valor: (m) => m.emergencias, formatar: String,
    texto: () => "Itens comprados fora da lista numa ida de reposição. Quanto menos, melhor o planejamento." },
  { chave: "rupturas", rotulo: "Rupturas", melhorQuando: "menor", valor: (m) => m.rupturas, formatar: String,
    texto: () => "Produtos que acabaram antes da hora (marcados como acabou ou comprados de emergência)." },
  { chave: "conferencia", rotulo: "Tempo médio de conferência", melhorQuando: "menor", valor: (m) => m.tempoMedioConferenciaSegundos, formatar: min,
    texto: (a) => (a === undefined ? "Nenhuma conferência concluída neste mês." : a < 180 ? "Dentro da meta de menos de 3 minutos." : "Acima da meta de 3 minutos: confira só o que vence na ida.") },
  { chave: "casados", rotulo: "Itens já no catálogo", melhorQuando: "maior", valor: (m) => m.itensCasadosPct, formatar: (v) => `${Math.round(v)}%`,
    texto: (a) => (a === undefined ? "Sem notas importadas neste mês." : a >= 90 ? "Acima da meta de 90%: o catálogo já conhece o que você compra." : "Meta: mais de 90% depois de 4 ou 5 compras.") },
  { chave: "deslocamento", rotulo: "Gasto com deslocamento", melhorQuando: "menor", valor: (m) => m.deslocamentoCentavos, formatar: brl,
    texto: () => "Soma do custo das idas (só dinheiro)." },
  { chave: "minutos", rotulo: "Minutos em idas", melhorQuando: "menor", valor: (m) => m.minutosEmIdas, formatar: (v) => `${v} min`,
    texto: () => "Tempo de deslocamento, ida e volta. Só informação: não vira dinheiro." },
];

export function Painel() {
  const { dados, carregando } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const [compras, listas, itensLista, mercados, conferencias] = await Promise.all([
      r.compras.listar(), r.listas.listar(), r.itensLista.listar(), r.mercados.listar(), r.conferencias.listar(),
    ]);
    const entrada = { compras, listas, itensLista, mercados, conferencias };
    const mes = hojeRecife().slice(0, 7);
    return { tem: painelTemDados(entrada), atual: metricasDoMes(entrada, mes), anterior: metricasDoMes(entrada, mesAnterior(mes)), mes };
  }, ["compras", "listas", "itensLista", "mercados", "conferencias"]);

  if (carregando || !dados) return <p aria-live="polite">Carregando...</p>;
  if (!dados.tem) {
    return (
      <EmptyState titulo="O painel começa com a primeira nota" acao={<Link href="/importar" className="inline-flex min-h-11 items-center font-medium text-verde underline">Importar uma nota</Link>}>
        Depois de algumas compras, você acompanha aqui se as idas e as emergências estão caindo. Até lá não há números para mostrar.
      </EmptyState>
    );
  }
  const { atual, anterior } = dados;
  const tipos = Object.entries(atual.idasPorTipo);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-texto/70">Este mês contra o mês anterior. ▼ melhorou · ▲ piorou.</p>
      {atual.idas === 0 ? <Alert tipo="info">Nenhuma compra neste mês ainda: os números abaixo contam só o que já aconteceu.</Alert> : null}
      {DEFS.map((d) => {
        const a = d.valor(atual);
        const b = d.valor(anterior);
        const t = tendencia(a, b, d.melhorQuando);
        return (
          <Card key={d.chave} className="flex flex-col gap-1 p-3" aria-label={d.rotulo}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-medium">{d.rotulo}</h2>
              <p className="text-xl font-semibold" aria-label={`${d.rotulo}: valor do mês`}>
                {a === undefined ? "—" : d.formatar(a)}
                {SETA[t] ? (
                  <span className={t === "melhorou" ? "ml-1 text-verde" : t === "piorou" ? "ml-1 text-erro" : "ml-1 text-texto/70"} aria-label={`tendência: ${t}`}>
                    {SETA[t]}
                  </span>
                ) : null}
              </p>
            </div>
            <p className="text-xs text-texto/70">Mês anterior: {b === undefined ? "—" : d.formatar(b)}</p>
            <p className="text-sm">{d.texto(a, t)}</p>
            {d.chave === "idas" && tipos.length ? (
              <ul className="text-xs text-texto/70">
                {tipos.map(([tipo, n]) => (
                  <li key={tipo}>
                    {tipo === "sem_lista" ? "Sem lista" : TIPO_IDA_ROTULO[tipo as keyof typeof TIPO_IDA_ROTULO]}: {n}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
