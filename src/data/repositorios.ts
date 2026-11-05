// Interfaces dos repositórios: único ponto de acesso a persistência (AGENTS.md seção 5).
import type {
  AgendaIda,
  ApelidoMercado,
  Casa,
  Compra,
  Estoque,
  ItemLista,
  Lista,
  Mercado,
  Perfil,
  Produto,
} from "@/domain/types";

export interface Colecao<T, K = string> {
  obter(chave: K): Promise<T | undefined>;
  listar(): Promise<T[]>;
  /** Valida com Zod, grava (sobrescreve por chave) e devolve o registro como foi gravado. */
  salvar(item: T): Promise<T>;
  apagar(chave: K): Promise<void>;
}

export type ChaveApelido = readonly [cnpj: string, codigo: string];

export type RepoCasas = Colecao<Casa>;
export interface RepoPerfis extends Colecao<Perfil> {
  obterDaCasa(casaId: string): Promise<Perfil | undefined>;
}
export type RepoAgendas = Colecao<AgendaIda>;
export interface RepoMercados extends Colecao<Mercado> {
  obterPorCnpj(cnpj: string): Promise<Mercado | undefined>;
}
export type RepoProdutos = Colecao<Produto>;
export interface RepoApelidos extends Colecao<ApelidoMercado, ChaveApelido> {
  listarPorCnpj(cnpj: string): Promise<ApelidoMercado[]>;
  listarPorProduto(produtoId: string): Promise<ApelidoMercado[]>;
}
export interface RepoEstoques extends Colecao<Estoque> {
  obterPorProduto(produtoId: string): Promise<Estoque | undefined>;
}
export interface RepoCompras extends Colecao<Compra> {
  /** Mais recente primeiro. */
  listarPorEmissao(): Promise<Compra[]>;
  listarPorMercado(mercadoId: string): Promise<Compra[]>;
}
export type RepoListas = Colecao<Lista>;
export interface RepoItensLista extends Colecao<ItemLista> {
  listarPorLista(listaId: string): Promise<ItemLista[]>;
  apagarPorLista(listaId: string): Promise<void>;
}

export interface Repositorios {
  readonly casas: RepoCasas;
  readonly perfis: RepoPerfis;
  readonly agendas: RepoAgendas;
  readonly mercados: RepoMercados;
  readonly produtos: RepoProdutos;
  readonly apelidos: RepoApelidos;
  readonly estoques: RepoEstoques;
  readonly compras: RepoCompras;
  readonly listas: RepoListas;
  readonly itensLista: RepoItensLista;
  /** Cria a casa padrão e o perfil na primeira abertura; devolve a casa. */
  iniciar(): Promise<Casa>;
  /** Fecha a conexão (testes). */
  fechar(): void;
}
