// Importação de nota: orquestra domínio e repositórios. Nunca persiste CPF nem o texto bruto.
import { chaveDeNome, metaAutomatica, novoProduto } from "@/domain/catalogo";
import { sugerirTipoMercado } from "@/domain/mercados";
import { suggestName, type NotaParseada } from "@/domain/nfce/parser";
import type { Compra, Mercado, Produto } from "@/domain/types";
import type { Repositorios } from "./repositorios";

export class NotaDuplicadaError extends Error {
  constructor(public readonly chave: string) {
    super("Esta nota já foi importada.");
    this.name = "NotaDuplicadaError";
  }
}

export type ItemConferencia = {
  codigo: string;
  descricao: string;
  /** Nome pré-preenchido: o do apelido já guardado ou a sugestão a partir da descrição. */
  sugestaoNome: string;
  /** Verdadeiro quando nem o apelido nem o nome existem no catálogo. */
  novo: boolean;
};

export async function prepararConferencia(repos: Repositorios, nota: NotaParseada): Promise<ItemConferencia[]> {
  const produtos = await repos.produtos.listar();
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const nomes = new Set(produtos.map((p) => chaveDeNome(p.nome)));
  const itens: ItemConferencia[] = [];
  for (const item of nota.itens) {
    const apelido = await repos.apelidos.obter([nota.loja.cnpj, item.codigo]);
    const doApelido = apelido ? porId.get(apelido.produtoId) : undefined;
    const sugestaoNome = doApelido?.nome ?? suggestName(item.descricao);
    itens.push({
      codigo: item.codigo,
      descricao: item.descricao,
      sugestaoNome,
      novo: !doApelido && !nomes.has(chaveDeNome(sugestaoNome)),
    });
  }
  return itens;
}

export type EntradaImportacao = {
  nota: NotaParseada;
  /** Chave de 44 dígitos já validada. */
  chave: string;
  /** Nome do produto escolhido para cada código interno do mercado. */
  nomes: Readonly<Record<string, string>>;
  agora?: Date;
  /** Permite sobrescrever uma compra existente com a mesma chave. */
  substituir?: boolean;
};

export type ResultadoImportacao = { compra: Compra; mercado: Mercado; produtosCriados: Produto[] };

export async function salvarNotaImportada(repos: Repositorios, entrada: EntradaImportacao): Promise<ResultadoImportacao> {
  const { nota, chave, nomes } = entrada;
  if (!nota.emissao) throw new Error("Nota sem data de emissão.");
  const emissao = nota.emissao;
  const casa = await repos.iniciar();

  if (!entrada.substituir && (await repos.compras.obter(chave))) throw new NotaDuplicadaError(chave);

  let mercado = await repos.mercados.obterPorCnpj(nota.loja.cnpj);
  if (!mercado) {
    mercado = await repos.mercados.salvar({
      id: crypto.randomUUID(),
      casaId: casa.id,
      cnpj: nota.loja.cnpj,
      nome: nota.loja.nome || `Mercado ${nota.loja.cnpj}`,
      endereco: nota.loja.endereco,
      tipo: sugerirTipoMercado(nota.loja.nome),
      transporte: "carro",
    });
  }

  const produtos = await repos.produtos.listar();
  const porNome = new Map(produtos.map((p) => [chaveDeNome(p.nome), p]));
  const produtosCriados: Produto[] = [];

  const itens: Compra["itens"] = [];
  for (const item of nota.itens) {
    const nome = (nomes[item.codigo] ?? "").trim() || suggestName(item.descricao);
    let produto = porNome.get(chaveDeNome(nome));
    if (!produto) {
      produto = await repos.produtos.salvar(
        novoProduto({ id: crypto.randomUUID(), casaId: casa.id, nome, item, mercadoTipo: mercado.tipo }),
      );
      porNome.set(chaveDeNome(nome), produto);
      produtosCriados.push(produto);
    }
    await repos.apelidos.salvar({ casaId: casa.id, cnpj: mercado.cnpj, codigo: item.codigo, produtoId: produto.id });
    itens.push({
      codigo: item.codigo,
      descricao: item.descricao,
      produtoId: produto.id,
      quantidade: item.quantidade,
      unidade: item.unidade,
      valorUnitarioCentavos: item.valorUnitarioCentavos,
      valorTotalCentavos: item.valorTotalCentavos,
    });
  }

  const compra = await repos.compras.salvar({
    casaId: casa.id,
    chave,
    mercadoId: mercado.id,
    emissao,
    valorTotalCentavos: nota.valorPagarCentavos ?? nota.somaItensCentavos,
    pagamento: nota.pagamento ?? "",
    itens,
    importadoEm: (entrada.agora ?? new Date()).toISOString(),
  });
  await atualizarMetasAutomaticas(repos, itens.flatMap((i) => (i.produtoId ? [i.produtoId] : [])));
  return { compra, mercado, produtosCriados };
}

/** Meta = média da quantidade por compra, enquanto o usuário não a editar à mão (`metaManual`). */
export async function atualizarMetasAutomaticas(repos: Repositorios, produtoIds: readonly string[]): Promise<void> {
  const compras = await repos.compras.listar();
  for (const id of new Set(produtoIds)) {
    const produto = await repos.produtos.obter(id);
    if (!produto || produto.metaManual) continue;
    const meta = metaAutomatica(id, compras);
    if (meta !== undefined && meta !== produto.meta) await repos.produtos.salvar({ ...produto, meta });
  }
}
