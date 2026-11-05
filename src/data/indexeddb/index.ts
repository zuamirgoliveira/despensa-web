import type { z } from "zod";
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
  RegistroConferencia,
} from "@/domain/types";
import { agendasIniciais } from "@/config/seed";
import {
  agendaIdaSchema,
  apelidoMercadoSchema,
  casaSchema,
  CASA_PADRAO_NOME,
  compraSchema,
  conferenciaSchema,
  estoqueSchema,
  itemListaSchema,
  listaSchema,
  mercadoSchema,
  perfilSchema,
  produtoSchema,
} from "@/schemas";
import type {
  ChaveApelido,
  RepoApelidos,
  RepoCompras,
  RepoEstoques,
  RepoItensLista,
  RepoMercados,
  RepoPerfis,
  Repositorios,
} from "../repositorios";
import { ColecaoIdb, pedido } from "./colecao";
import { aplicarMigracoes, VERSAO_BANCO } from "./migrations";
import type { Migracao } from "./migrations/tipos";

export const NOME_BANCO = "despensa";

export type OpcoesBanco = {
  nomeBanco?: string;
  /** Fábrica de IndexedDB (testes usam fake-indexeddb). */
  indexedDB?: IDBFactory;
  migracoes?: readonly Migracao[];
};

export function abrirBanco(opcoes: OpcoesBanco = {}): Promise<IDBDatabase> {
  const fabrica = opcoes.indexedDB ?? globalThis.indexedDB;
  const migracoes = opcoes.migracoes;
  const versao = migracoes ? migracoes[migracoes.length - 1].versao : VERSAO_BANCO;
  return new Promise((resolve, reject) => {
    const req = fabrica.open(opcoes.nomeBanco ?? NOME_BANCO, versao);
    req.onupgradeneeded = (e) => {
      aplicarMigracoes(req.result, req.transaction as IDBTransaction, e.oldVersion, migracoes);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Banco bloqueado por outra aba aberta."));
  });
}

class Mercados extends ColecaoIdb<Mercado> implements RepoMercados {
  async obterPorCnpj(cnpj: string): Promise<Mercado | undefined> {
    return (await this.listarPorIndice("cnpj", cnpj))[0];
  }
}

class Perfis extends ColecaoIdb<Perfil> implements RepoPerfis {
  async obterDaCasa(casaId: string): Promise<Perfil | undefined> {
    return (await this.listarPorIndice("casaId", casaId))[0];
  }
}

class Apelidos extends ColecaoIdb<ApelidoMercado, ChaveApelido> implements RepoApelidos {
  listarPorCnpj(cnpj: string): Promise<ApelidoMercado[]> {
    return this.listarPorIndice("cnpj", cnpj);
  }
  listarPorProduto(produtoId: string): Promise<ApelidoMercado[]> {
    return this.listarPorIndice("produtoId", produtoId);
  }
}

class Estoques extends ColecaoIdb<Estoque> implements RepoEstoques {
  async obterPorProduto(produtoId: string): Promise<Estoque | undefined> {
    return (await this.listarPorIndice("produtoId", produtoId))[0];
  }
}

class Compras extends ColecaoIdb<Compra> implements RepoCompras {
  async listarPorEmissao(): Promise<Compra[]> {
    const tx = this.db.transaction(this.nome, "readonly");
    const todos = await pedido(tx.objectStore(this.nome).index("emissao").getAll());
    return todos.map((v) => this.ler(v)).reverse();
  }
  listarPorMercado(mercadoId: string): Promise<Compra[]> {
    return this.listarPorIndice("mercadoId", mercadoId);
  }
}

class ItensLista extends ColecaoIdb<ItemLista> implements RepoItensLista {
  listarPorLista(listaId: string): Promise<ItemLista[]> {
    return this.listarPorIndice("listaId", listaId);
  }
  apagarPorLista(listaId: string): Promise<void> {
    return this.apagarPorIndice("listaId", listaId);
  }
}

// Os tipos de entidade são a saída dos schemas; `z.ZodType<T>` aceita entrada desconhecida.
const sch = <T>(s: z.ZodType<T>): z.ZodType<T> => s;

export function criarRepositoriosComBanco(db: IDBDatabase): Repositorios {
  const casas = new ColecaoIdb<Casa>(db, "casas", sch(casaSchema));
  const perfis = new Perfis(db, "perfis", sch(perfilSchema));
  const agendas = new ColecaoIdb<AgendaIda>(db, "agendas", sch(agendaIdaSchema));
  return {
    casas,
    perfis,
    agendas,
    mercados: new Mercados(db, "mercados", sch(mercadoSchema)),
    produtos: new ColecaoIdb<Produto>(db, "produtos", sch(produtoSchema)),
    apelidos: new Apelidos(db, "apelidos", sch(apelidoMercadoSchema)),
    estoques: new Estoques(db, "estoques", sch(estoqueSchema)),
    compras: new Compras(db, "compras", sch(compraSchema)),
    listas: new ColecaoIdb<Lista>(db, "listas", sch(listaSchema)),
    itensLista: new ItensLista(db, "itensLista", sch(itemListaSchema)),
    conferencias: new ColecaoIdb<RegistroConferencia>(db, "conferencias", sch(conferenciaSchema)),
    async iniciar(): Promise<Casa> {
      let casa = (await casas.listar())[0];
      if (!casa) {
        // Primeira abertura: casa, perfil com padrões e agenda inicial (só aqui; apagar depois não recria).
        casa = await casas.salvar({ id: crypto.randomUUID(), nome: CASA_PADRAO_NOME });
        for (const a of agendasIniciais(casa.id, () => crypto.randomUUID())) await agendas.salvar(a);
      }
      if (!(await perfis.obterDaCasa(casa.id))) {
        await perfis.salvar(perfilSchema.parse({ id: crypto.randomUUID(), casaId: casa.id }));
      }
      return casa;
    },
    fechar: () => db.close(),
  };
}

let compartilhado: Promise<Repositorios> | undefined;

/**
 * Fábrica usada pelas telas. Sem opções, devolve uma instância única sobre o IndexedDB do
 * navegador. Com opções (testes), abre uma instância própria. Em ambos, garante a casa padrão.
 */
export function criarRepositorios(opcoes?: OpcoesBanco): Promise<Repositorios> {
  const abrir = async (): Promise<Repositorios> => {
    const repos = criarRepositoriosComBanco(await abrirBanco(opcoes));
    await repos.iniciar();
    return repos;
  };
  if (opcoes) return abrir();
  compartilhado ??= abrir().catch((e: unknown) => {
    compartilhado = undefined;
    throw e;
  });
  return compartilhado;
}
