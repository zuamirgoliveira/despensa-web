// Estimativa da ida ao importar a nota (RF-804 a RF-806, RF-705). Nunca bloqueia a importação.
import { custoIdaDoMercado, type MeioDeTransporte } from "@/domain/ida";
import type { Mercado } from "@/domain/types";
import { calcularRota, geocodificarMercado } from "@/lib/estimativaIda";
import { MapasError, type Mapas, type MotivoErroMapas } from "@/lib/mapas";
import type { Repositorios } from "./repositorios";

export type ResultadoEstimativa =
  | {
      status: "ok";
      mercado: Mercado;
      distanciaKm: number;
      tempoMin: number;
      /** Só o bairro foi achado (o endereço da nota vem cortado): mostrar como aproximado. */
      aproximado: boolean;
      /** Bike calculada pelo fator sobre o carro (o serviço não devolveu rota de bicicleta). */
      estimadaPorFator: boolean;
    }
  | { status: "sem_casa" }
  | { status: "offline" }
  | { status: "endereco_nao_encontrado" }
  | { status: "falha"; motivo: MotivoErroMapas };

// a pé usa a malha viária do carro (sem fator); o custo é zero de qualquer forma
const MEIO_DE_ROTA = { carro: "carro", bike_eletrica: "bike", a_pe: "carro" } as const;

/**
 * Estima distância e tempo de ida (casa → mercado) para o meio de transporte. Guarda as coordenadas do
 * mercado (cache por mercado: o endereço só é geocodificado uma vez). Sem casa cadastrada, sem internet
 * ou com falha do serviço devolve um status em vez de lançar: a importação segue normalmente.
 */
export async function estimarMercado(
  repos: Repositorios,
  mapas: Mapas,
  mercadoId: string,
  meio: MeioDeTransporte,
  opcoes: { online?: boolean; esperar?: (ms: number) => Promise<void> } = {},
): Promise<ResultadoEstimativa> {
  const mercado = await repos.mercados.obter(mercadoId);
  const casa = await repos.iniciar();
  const perfil = await repos.perfis.obterDaCasa(casa.id);
  if (!mercado || !perfil?.localizacaoCasa) return { status: "sem_casa" };
  if (opcoes.online === false) return { status: "offline" };

  try {
    let atual = mercado;
    let aproximado = false;
    if (!atual.coordenadas) {
      const ponto = await geocodificarMercado(mapas, atual.endereco, opcoes.esperar);
      if (!ponto) return { status: "endereco_nao_encontrado" };
      atual = await repos.mercados.salvar({ ...atual, coordenadas: ponto.coordenadas });
      aproximado = ponto.precisao === "bairro";
    }
    const rota = await calcularRota(mapas, perfil.localizacaoCasa, atual.coordenadas as NonNullable<Mercado["coordenadas"]>, MEIO_DE_ROTA[meio]);
    return { status: "ok", mercado: atual, distanciaKm: rota.km, tempoMin: rota.min, aproximado, estimadaPorFator: rota.estimadaPorFator };
  } catch (e) {
    if (e instanceof MapasError) return { status: e.motivo === "rede" ? "offline" : "falha", motivo: e.motivo } as ResultadoEstimativa;
    throw e;
  }
}

/**
 * Confirma (ou registra à mão) distância e tempo de ida do mercado e grava o custo da ida nas compras
 * dele que ainda não têm (RN-10). Devolve o custo calculado, ou `undefined` se não há distância.
 */
export async function confirmarEstimativa(
  repos: Repositorios,
  mercadoId: string,
  v: { meio: MeioDeTransporte; distanciaKm: number; tempoMin?: number },
  chaveDaCompra?: string,
): Promise<{ mercado: Mercado; custoIdaCentavos: number | undefined }> {
  const mercado = await repos.mercados.obter(mercadoId);
  if (!mercado) throw new Error("Mercado não encontrado.");
  const salvo = await repos.mercados.salvar({ ...mercado, transporte: v.meio, distanciaKm: v.distanciaKm, tempoMinIda: v.tempoMin });
  const daCompra = chaveDaCompra ? await registrarIdaDaCompra(repos, chaveDaCompra, v.meio) : undefined;
  const dasOutras = await aplicarCustoNasCompras(repos, salvo);
  return { mercado: salvo, custoIdaCentavos: daCompra ?? dasOutras };
}

/**
 * Registra como a pessoa foi a ESTA compra (perguntado a cada nota: o mesmo mercado pode ser de carro,
 * bike ou a pé). Grava `meio` e o custo da ida na compra; o mercado guarda o último meio usado.
 * A distância vem do mercado; sem ela, só o meio é guardado e o custo fica pendente.
 */
export async function registrarIdaDaCompra(repos: Repositorios, chave: string, meio: MeioDeTransporte): Promise<number | undefined> {
  const compra = await repos.compras.obter(chave);
  if (!compra) return undefined;
  const mercado = await repos.mercados.obter(compra.mercadoId);
  const casa = await repos.iniciar();
  const perfil = await repos.perfis.obterDaCasa(casa.id);
  if (mercado && mercado.transporte !== meio) await repos.mercados.salvar({ ...mercado, transporte: meio });
  const custo = mercado && perfil ? custoIdaDoMercado({ ...mercado, transporte: meio }, perfil) : undefined;
  await repos.compras.salvar({ ...compra, meio, custoIdaCentavos: custo });
  return custo;
}

/** Meio usado na compra mais recente do mercado (só para mostrar "última vez"; nunca preenche sozinho). */
export async function ultimoMeioDoMercado(repos: Repositorios, mercadoId: string): Promise<MeioDeTransporte | undefined> {
  const compras = (await repos.compras.listarPorMercado(mercadoId)).filter((c) => c.meio).sort((a, b) => b.emissao.localeCompare(a.emissao));
  return compras[0]?.meio;
}

/** Grava `custoIdaCentavos` nas compras do mercado que ainda não têm, usando o transporte e a distância dele. */
export async function aplicarCustoNasCompras(repos: Repositorios, mercado: Mercado): Promise<number | undefined> {
  const casa = await repos.iniciar();
  const perfil = await repos.perfis.obterDaCasa(casa.id);
  if (!perfil) return undefined;
  const custo = custoIdaDoMercado(mercado, perfil);
  if (custo === undefined) return undefined;
  for (const c of await repos.compras.listarPorMercado(mercado.id)) {
    if (c.custoIdaCentavos === undefined) await repos.compras.salvar({ ...c, custoIdaCentavos: custo });
  }
  return custo;
}
