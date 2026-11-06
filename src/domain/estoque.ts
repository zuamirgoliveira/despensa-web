// Estoque por nível, consumo e cobertura (AGENTS.md 6.1). Funções puras: `hoje` é sempre parâmetro.
import { diasEntre, soData } from "@/lib/datas";
import type { Compra, Estoque, Nivel, Produto } from "./types";

const FRACAO: Record<Nivel, number> = { cheio: 1, metade: 0.5, acabando: 0.2, acabou: 0 };

/** Dias de cobertura abaixo dos quais um produto "provavelmente está acabando". */
export const LIMITE_PROVAVELMENTE_ACABANDO_DIAS = 2;
/** Quantidade máxima de intervalos entre compras usada na média do consumo. */
export const MAX_RAZOES_CONSUMO = 4;

const DIVISOR_FREQUENCIA: Partial<Record<Produto["frequencia"], number>> = { semanal: 7, quinzenal: 15, mensal: 30 };

export function fracaoDoNivel(nivel: Nivel): number {
  return FRACAO[nivel];
}

/** Estoque estimado = fração do nível × quantidade de referência. */
export function estoqueEstimado(nivel: Nivel, quantidadeReferencia: number): number {
  return FRACAO[nivel] * quantidadeReferencia;
}

type CompraDoProduto = { data: string; quantidade: number };

/** Compras do produto por data (soma os itens do mesmo produto na mesma nota), da mais antiga à mais nova. */
export function comprasDoProduto(produtoId: string, compras: readonly Compra[]): CompraDoProduto[] {
  const lista: CompraDoProduto[] = [];
  for (const c of compras) {
    const q = c.itens.filter((i) => i.produtoId === produtoId).reduce((s, i) => s + i.quantidade, 0);
    if (q > 0) lista.push({ data: soData(c.emissao), quantidade: q });
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/** Quantidade de referência do produto: a meta; sem meta, a última quantidade comprada (0 se nunca comprou). */
export function quantidadeReferencia(produto: Pick<Produto, "id" | "meta">, compras: readonly Compra[]): number {
  if (produto.meta > 0) return produto.meta;
  const feitas = comprasDoProduto(produto.id, compras);
  return feitas.length ? feitas[feitas.length - 1].quantidade : 0;
}

/**
 * Consumo diário. Com 2 ou mais compras: média das últimas até 4 razões
 * `quantidade_i ÷ dias(i → i+1)`, ignorando intervalos de 0 dia. Senão, pela frequência declarada
 * (semanal meta/7, quinzenal meta/15, mensal meta/30). `undefined` quando não há como estimar (sob demanda).
 */
export function consumoDiario(
  produto: Pick<Produto, "id" | "meta" | "frequencia">,
  compras: readonly Compra[],
): number | undefined {
  const feitas = comprasDoProduto(produto.id, compras);
  if (feitas.length >= 2) {
    const razoes: number[] = [];
    for (let i = 0; i < feitas.length - 1; i++) {
      const dias = diasEntre(feitas[i].data, feitas[i + 1].data);
      if (dias > 0) razoes.push(feitas[i].quantidade / dias);
    }
    const ultimas = razoes.slice(-MAX_RAZOES_CONSUMO);
    if (ultimas.length) return ultimas.reduce((s, r) => s + r, 0) / ultimas.length;
  }
  const divisor = DIVISOR_FREQUENCIA[produto.frequencia];
  return divisor ? produto.meta / divisor : undefined;
}

/** Dias que o estoque dura. `Infinity` quando o consumo é zero ou desconhecido. */
export function coberturaDias(estoque: number, consumo: number | undefined): number {
  if (!consumo || consumo <= 0) return Infinity;
  return estoque / consumo;
}

/** Estoque previsto daqui a `dias` dias: nunca abaixo de zero. Sem consumo conhecido, não muda. */
export function estoqueNaData(estoqueAgora: number, consumo: number | undefined, dias: number): number {
  return Math.max(0, estoqueAgora - (consumo ?? 0) * dias);
}

/**
 * Estoque estimado hoje: o do nível confirmado, descontado o consumo desde a confirmação
 * (`confirmadoEm` é um instante ISO; só a data conta).
 */
export function estoqueAgora(
  nivel: Nivel,
  quantidadeRef: number,
  consumo: number | undefined,
  confirmadoEm: string,
  hoje: string,
): number {
  const dias = Math.max(0, diasEntre(soData(confirmadoEm), hoje));
  return estoqueNaData(estoqueEstimado(nivel, quantidadeRef), consumo, dias);
}

/**
 * Produto comprado **soma** a quantidade comprada ao estoque (a quantidade pode passar do padrão).
 * Devolve só os registros que mudam ou nascem (um por produto da compra); `gerarId` é injetado.
 * - `anterior`: a mesma nota importada antes (reimportação). Só a diferença entra, então reimportar não soma duas vezes.
 * - Nota mais antiga que a última confirmação do estoque (`confirmadoEm`) não altera nada: a contagem posterior já a inclui.
 * O rótulo `nivel` fica `cheio`; quem grava o ajusta pelo padrão (`nivelDeQuantidade`).
 */
export function aplicarCompra(
  estoques: readonly Estoque[],
  compra: Pick<Compra, "casaId" | "itens">,
  confirmadoEm: string,
  gerarId: () => string,
  anterior?: Pick<Compra, "itens">,
): Estoque[] {
  const porProduto = new Map(estoques.map((e) => [e.produtoId, e]));
  const vistos = new Set<string>();
  const saida: Estoque[] = [];
  const somar = (c: Pick<Compra, "itens"> | undefined, id: string) =>
    c ? c.itens.filter((i) => i.produtoId === id).reduce((s, i) => s + i.quantidade, 0) : 0;
  const arred = (n: number) => Math.round(n * 1000) / 1000;
  for (const item of compra.itens) {
    const id = item.produtoId;
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const atual = porProduto.get(id);
    const delta = arred(somar(compra, id) - somar(anterior, id));
    if (atual && soData(confirmadoEm) < soData(atual.confirmadoEm)) continue;
    if (atual && delta === 0) continue;
    saida.push(
      atual
        ? { ...atual, nivel: "cheio", quantidade: arred(Math.max(0, atual.quantidade + delta)), quantidadeExata: undefined, confirmadoEm }
        : { id: gerarId(), casaId: compra.casaId, produtoId: id, nivel: "cheio", quantidade: Math.max(0, delta), confirmadoEm },
    );
  }
  return saida;
}

/**
 * "Provavelmente acabando": cobertura estimada de hoje menor que 2 dias e nível ainda não é
 * `acabando` nem `acabou` → pede confirmação do usuário (RF-403).
 */
export function sugerirProvavelmenteAcabando(
  produto: Pick<Produto, "id" | "meta" | "frequencia">,
  estoque: Pick<Estoque, "nivel" | "confirmadoEm">,
  compras: readonly Compra[],
  hoje: string,
): boolean {
  if (estoque.nivel === "acabando" || estoque.nivel === "acabou") return false;
  const consumo = consumoDiario(produto, compras);
  const agora = estoqueAgora(estoque.nivel, quantidadeReferencia(produto, compras), consumo, estoque.confirmadoEm, hoje);
  return coberturaDias(agora, consumo) < LIMITE_PROVAVELMENTE_ACABANDO_DIAS;
}
