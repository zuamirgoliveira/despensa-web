// Geração da lista de compras por tipo de ida (AGENTS.md 6.3). Funções puras: nada de relógio nem I/O.
import { adicionarDias, diasEntre } from "@/lib/datas";
import { idaSeguinte, proximaIdaDoTipo, tiposCompativeis, type Ida } from "./agenda";
import { consumoDiario, coberturaDias, estoqueAgora, estoqueNaData, quantidadeReferencia } from "./estoque";
import type { AgendaIda, Compra, Estoque, ItemLista, Produto, TipoIda } from "./types";
import { LIMITE_PERECIVEL_DIAS } from "@/schemas/constantes";

export type MotivoItem = "acabou" | "cobertura" | "puxado";

export type ItemListaSugerido = {
  produtoId: string;
  quantidade: number;
  motivo: MotivoItem;
  urgente: boolean;
  precoEstimadoCentavos?: number;
};

export type ResumoLista = {
  totalEstimadoCentavos: number;
  /** Produtos sem preço conhecido: ficam fora da soma. */
  semPreco: string[];
  avisos: string[];
};

export type ResultadoLista = { ida: Ida; itens: ItemListaSugerido[]; resumo: ResumoLista };

export type EntradaLista = {
  tipo: TipoIda;
  hoje: string;
  produtos: readonly Produto[];
  estoques: readonly Estoque[];
  compras: readonly Compra[];
  agendas: readonly AgendaIda[];
  folgaDias: number;
};

/** Menor quantidade comprável por unidade do produto. */
const PASSO: Record<Produto["unidade"], number> = { kg: 0.1, un: 1, pacote: 1, l: 0.5 };

/** Menor passo de quantidade por unidade (botões +/− da lista). */
export function passoDaUnidade(unidade: Produto["unidade"]): number {
  return PASSO[unidade];
}

const arred = (n: number): number => Math.round(n * 1000) / 1000;

/** `a < b` tolerando erro de ponto flutuante (8,999999999999998 não é menor que 9). */
const abaixo = (a: number, b: number): boolean => a < b - 1e-9;

/** Arredonda para cima ao múltiplo de `passo`, sem erro de ponto flutuante. */
export function arredondarParaCima(valor: number, passo: number): number {
  return arred(Math.ceil(Math.round((valor / passo) * 1e6) / 1e6) * passo);
}

function arredondarParaBaixo(valor: number, passo: number): number {
  return arred(Math.floor(Math.round((valor / passo) * 1e6) / 1e6) * passo);
}

/** Último preço unitário (centavos) pago pelo produto, ou undefined se nunca foi comprado. */
export function ultimoPrecoUnitario(produtoId: string, compras: readonly Compra[]): number | undefined {
  let melhor: { emissao: string; preco: number } | undefined;
  for (const c of compras) {
    for (const i of c.itens) {
      if (i.produtoId === produtoId && (!melhor || c.emissao >= melhor.emissao)) {
        melhor = { emissao: c.emissao, preco: i.valorUnitarioCentavos };
      }
    }
  }
  return melhor?.preco;
}

export type Situacao = {
  produto: Produto;
  /** Tipo de ida efetivo (perecível de feira mensal vira o tipo semanal compatível). */
  tipoProprio: TipoIda;
  consumo: number | undefined;
  nivel: Estoque["nivel"];
  estoqueHoje: number;
  coberturaHoje: number;
  aviso?: string;
};

export function situacaoDoProduto(p: Produto, e: EntradaLista): Situacao {
  const registro = e.estoques.find((x) => x.produtoId === p.id);
  const consumo = consumoDiario(p, e.compras);
  const ref = quantidadeReferencia(p, e.compras);
  // Sem registro de estoque: assume cheio desde a última compra (ou desde hoje, se nunca comprou).
  const ultimaCompra = e.compras
    .filter((c) => c.itens.some((i) => i.produtoId === p.id))
    .map((c) => c.emissao)
    .sort()
    .pop();
  const nivel = registro?.nivel ?? "cheio";
  const confirmadoEm = registro?.confirmadoEm ?? ultimaCompra ?? `${e.hoje}T00:00:00`;
  const estoqueHoje = estoqueAgora(nivel, ref, consumo, confirmadoEm, e.hoje);

  let tipoProprio = p.tipoIda;
  let aviso: string | undefined;
  if (p.tipoIda === "feira_mensal" && p.vidaUtilDias <= LIMITE_PERECIVEL_DIAS) {
    tipoProprio = tiposCompativeis(p)[0];
    aviso = `${p.nome} é perecível e está configurado para a feira mensal: tratado como compra semanal.`;
  }
  return { produto: p, tipoProprio, consumo, nivel, estoqueHoje, coberturaHoje: coberturaDias(estoqueHoje, consumo), aviso };
}

/** Fim do horizonte: a próxima ida do tipo próprio depois de `ida` (ou do tipo da própria ida, se faltar agenda). */
function fimDoHorizonte(agendas: readonly AgendaIda[], tipoProprio: TipoIda, ida: Ida): string {
  const proprio = idaSeguinte(agendas, tipoProprio, ida.data);
  const fallback = idaSeguinte(agendas, ida.tipo, ida.data);
  return (proprio ?? fallback)?.data ?? adicionarDias(ida.data, 7);
}

function calcularQuantidade(s: Situacao, ida: Ida, e: EntradaLista): number {
  const { produto: p, consumo } = s;
  const passo = PASSO[p.unidade];
  const minimo = passo;
  if (!consumo || consumo <= 0) return Math.max(minimo, arredondarParaCima(p.meta, passo));

  const dias = diasEntre(e.hoje, ida.data);
  const estoqueEmT = estoqueNaData(s.estoqueHoje, consumo, dias);
  const ciclo = diasEntre(ida.data, fimDoHorizonte(e.agendas, s.tipoProprio, ida)) + e.folgaDias;
  const bruta = consumo * ciclo - estoqueEmT;
  const teto = consumo * p.vidaUtilDias;
  const arredondada = arredondarParaCima(Math.max(bruta, 0), passo);
  const dentroDoTeto = Math.min(arredondada, arredondarParaBaixo(teto, passo));
  return Math.max(minimo, dentroDoTeto);
}

type Decisao = { entra: false } | { entra: true; motivo: MotivoItem; urgente: boolean };

/** Ida escolhida para um produto que acabou: a própria, se for até amanhã; senão a primeira compatível. */
function idaDoAcabou(s: Situacao, e: EntradaLista): Ida | undefined {
  const propria = proximaIdaDoTipo(e.agendas, s.tipoProprio, e.hoje);
  if (propria && diasEntre(e.hoje, propria.data) <= 1) return propria;
  const candidatas = tiposCompativeis({ tipoIda: s.tipoProprio, categoria: s.produto.categoria })
    .map((t) => proximaIdaDoTipo(e.agendas, t, e.hoje))
    .filter((i): i is Ida => i !== undefined);
  if (propria) candidatas.unshift(propria); // em empate de data, a própria vence (o sort é estável)
  return candidatas.sort((a, b) => a.data.localeCompare(b.data))[0];
}

function decidir(s: Situacao, ida: Ida, e: EntradaLista): Decisao {
  const p = s.produto;
  if (!p.ativo) return { entra: false };

  if (s.nivel === "acabou") {
    const escolhida = idaDoAcabou(s, e);
    if (!escolhida || escolhida.tipo !== ida.tipo) return { entra: false };
    return { entra: true, motivo: "acabou", urgente: diasEntre(e.hoje, ida.data) > 1 };
  }

  if (p.frequencia === "sob_demanda") {
    return s.nivel === "acabando" && s.tipoProprio === ida.tipo
      ? { entra: true, motivo: "cobertura", urgente: false }
      : { entra: false };
  }

  const consumo = s.consumo;
  if (!consumo || consumo <= 0) return { entra: false };
  const estoqueEmT = estoqueNaData(s.estoqueHoje, consumo, diasEntre(e.hoje, ida.data));

  if (s.tipoProprio === ida.tipo) {
    // Produto de feira cujo estoque acaba antes dela e que tem ida compatível antes: vai para essa ida.
    if (ida.tipo === "feira_mensal" && puxadoParaAntes(s, ida, e)) return { entra: false };
    const t2 = idaSeguinte(e.agendas, ida.tipo, ida.data);
    const ciclo = (t2 ? diasEntre(ida.data, t2.data) : 7) + e.folgaDias;
    return abaixo(estoqueEmT / consumo, ciclo) ? { entra: true, motivo: "cobertura", urgente: false } : { entra: false };
  }

  // Puxar para uma ida anterior (produto de feira mensal em ida compatível).
  if (p.tipoIda === "feira_mensal" && tiposCompativeis({ tipoIda: s.tipoProprio, categoria: p.categoria }).includes(ida.tipo)) {
    const feira = proximaIdaDoTipo(e.agendas, "feira_mensal", e.hoje);
    if (!feira || ida.data >= feira.data) return { entra: false }; // a própria feira cobre
    if (!abaixo(s.coberturaHoje, diasEntre(e.hoje, feira.data))) return { entra: false }; // dura até a feira
    const proxima = idaSeguinte(e.agendas, ida.tipo, ida.data);
    const ciclo = (proxima ? diasEntre(ida.data, proxima.data) : 7) + e.folgaDias;
    if (!abaixo(estoqueEmT / consumo, ciclo)) return { entra: false }; // aguenta até a ida seguinte
    const fimEstoque = adicionarDias(e.hoje, Math.floor(s.coberturaHoje));
    return { entra: true, motivo: "puxado", urgente: ida.data > fimEstoque };
  }
  return { entra: false };
}

/** Verdadeiro se o estoque do produto de feira acaba antes dela e existe ida compatível antes da feira. */
function puxadoParaAntes(s: Situacao, feira: Ida, e: EntradaLista): boolean {
  if (!abaixo(s.coberturaHoje, diasEntre(e.hoje, feira.data))) return false;
  return tiposCompativeis({ tipoIda: s.tipoProprio, categoria: s.produto.categoria }).some((t) => {
    const i = proximaIdaDoTipo(e.agendas, t, e.hoje);
    return i !== undefined && i.data < feira.data;
  });
}

/** Lista sugerida para a próxima ida do tipo pedido. Sem agenda do tipo, devolve `undefined`. */
export function gerarLista(e: EntradaLista): ResultadoLista | undefined {
  const ida = proximaIdaDoTipo(e.agendas, e.tipo, e.hoje);
  if (!ida) return undefined;

  const itens: ItemListaSugerido[] = [];
  const avisos: string[] = [];
  const semPreco: string[] = [];
  let total = 0;

  for (const p of e.produtos) {
    const s = situacaoDoProduto(p, e);
    const d = decidir(s, ida, e);
    if (!d.entra) continue;
    if (s.aviso) avisos.push(s.aviso);
    const quantidade = calcularQuantidade(s, ida, e);
    const item: ItemListaSugerido = { produtoId: p.id, quantidade, motivo: d.motivo, urgente: d.urgente };
    const preco = ultimoPrecoUnitario(p.id, e.compras);
    if (preco === undefined) semPreco.push(p.id);
    else {
      item.precoEstimadoCentavos = Math.round(quantidade * preco);
      total += item.precoEstimadoCentavos;
    }
    itens.push(item);
  }
  return { ida, itens, resumo: { totalEstimadoCentavos: total, semPreco, avisos } };
}

export type MudancasDaRegeracao = {
  adicionar: ItemListaSugerido[];
  atualizar: { id: string; quantidadeSugerida: number; motivo: MotivoItem; urgente: boolean }[];
  remover: string[];
};

/**
 * Regerar a lista preserva as edições manuais: item removido pelo usuário continua removido, quantidade
 * editada permanece, itens avulsos e extras ficam. Só acrescenta o que é novo e atualiza o que o usuário
 * não tocou. Itens automáticos intocados que deixaram de ser sugeridos saem.
 */
export function mesclarRegeracao(sugeridos: readonly ItemListaSugerido[], existentes: readonly ItemLista[]): MudancasDaRegeracao {
  const porProduto = new Map(existentes.filter((i) => i.produtoId).map((i) => [i.produtoId as string, i]));
  const sugeridosIds = new Set(sugeridos.map((s) => s.produtoId));
  const m: MudancasDaRegeracao = { adicionar: [], atualizar: [], remover: [] };

  for (const s of sugeridos) {
    const atual = porProduto.get(s.produtoId);
    if (!atual) m.adicionar.push(s);
    else if (!atual.removido && !atual.quantidadeEditada && atual.status === "pendente") {
      m.atualizar.push({ id: atual.id, quantidadeSugerida: s.quantidade, motivo: s.motivo, urgente: s.urgente });
    }
  }
  for (const i of existentes) {
    const automatico = i.produtoId !== undefined && i.motivo !== undefined && i.motivo !== "manual";
    if (automatico && !i.removido && !i.quantidadeEditada && i.status === "pendente" && !sugeridosIds.has(i.produtoId as string)) {
      m.remover.push(i.id);
    }
  }
  return m;
}


export type EstimativaAtual = { totalCentavos: number; semPreco: string[] };

/**
 * Estimativa de custo da lista como está agora (com as quantidades editadas): quantidade × último preço
 * do produto. Itens removidos ficam fora; itens sem preço (e avulsos) ficam fora da soma e são listados.
 */
export function estimarCusto(itens: readonly ItemLista[], compras: readonly Compra[]): EstimativaAtual {
  let total = 0;
  const semPreco: string[] = [];
  for (const i of itens) {
    if (i.removido) continue;
    const preco = i.produtoId ? ultimoPrecoUnitario(i.produtoId, compras) : undefined;
    if (preco === undefined) semPreco.push(i.id);
    else total += Math.round(i.quantidadeSugerida * preco);
  }
  return { totalCentavos: total, semPreco };
}
