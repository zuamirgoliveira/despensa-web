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
  DadosRestauracao,
  ModoRestauracao,
  RepoApelidos,
  RepoCompras,
  RepoEstoques,
  RepoItensLista,
  RepoMercados,
  RepoPerfis,
  Repositorios,
} from "../repositorios";
import { COLECOES, emitirMudanca } from "../eventos";
import { ColecaoIdb, concluida, DadoInvalidoError, pedido } from "./colecao";
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

/** Valida todos os registros e recusa chaves duplicadas, sem tocar no banco. */
function validarRestauracao(dados: DadosRestauracao): DadosRestauracao {
  const unica = (colecao: string, chaves: readonly string[]): void => {
    const vistas = new Set<string>();
    for (const c of chaves) {
      if (vistas.has(c)) throw new DadoInvalidoError(colecao, `chave duplicada na cópia: ${c}`);
      vistas.add(c);
    }
  };
  const ler = <T>(colecao: string, schema: z.ZodType<T>, itens: readonly unknown[]): T[] =>
    itens.map((item) => {
      const r = schema.safeParse(item);
      if (!r.success) throw new DadoInvalidoError(colecao, r.error.message);
      return r.data;
    });
  const v: DadosRestauracao = {
    casas: ler("casas", sch(casaSchema), dados.casas),
    perfis: ler("perfis", sch(perfilSchema), dados.perfis),
    agendas: ler("agendas", sch(agendaIdaSchema), dados.agendas),
    mercados: ler("mercados", sch(mercadoSchema), dados.mercados),
    produtos: ler("produtos", sch(produtoSchema), dados.produtos),
    apelidos: ler("apelidos", sch(apelidoMercadoSchema), dados.apelidos),
    estoques: ler("estoques", sch(estoqueSchema), dados.estoques),
    compras: ler("compras", sch(compraSchema), dados.compras),
    listas: ler("listas", sch(listaSchema), dados.listas),
    itensLista: ler("itensLista", sch(itemListaSchema), dados.itensLista),
    conferencias: ler("conferencias", sch(conferenciaSchema), dados.conferencias),
  };
  unica("casas", v.casas.map((x) => x.id));
  unica("perfis", v.perfis.map((x) => x.id));
  unica("agendas", v.agendas.map((x) => x.id));
  unica("mercados", v.mercados.map((x) => x.id));
  unica("produtos", v.produtos.map((x) => x.id));
  unica("apelidos", v.apelidos.map((x) => `${x.cnpj}|${x.codigo}`));
  unica("estoques", v.estoques.map((x) => x.id));
  unica("estoques", v.estoques.map((x) => x.produtoId)); // índice único por produto
  unica("compras", v.compras.map((x) => x.chave));
  unica("listas", v.listas.map((x) => x.id));
  unica("itensLista", v.itensLista.map((x) => x.id));
  unica("conferencias", v.conferencias.map((x) => x.id));
  return v;
}

/**
 * Em `mesclar`, a casa padrão criada na primeira abertura (sem dados) some, para não ficar com duas casas.
 * Devolve o que apagar; uma casa que tem dados nunca entra aqui.
 */
async function casaPadraoVaziaParaApagar(repos: Pick<Repositorios, "casas" | "perfis" | "agendas" | "compras" | "produtos" | "mercados">, ids: ReadonlySet<string>) {
  const alvo = { casas: [] as string[], perfis: [] as string[], agendas: [] as string[] };
  if (ids.size === 0) return alvo;
  const [compras, produtos, mercados, perfis, agendas] = await Promise.all([
    repos.compras.listar(),
    repos.produtos.listar(),
    repos.mercados.listar(),
    repos.perfis.listar(),
    repos.agendas.listar(),
  ]);
  for (const casa of await repos.casas.listar()) {
    if (ids.has(casa.id)) continue;
    if ([...compras, ...produtos, ...mercados].some((x) => x.casaId === casa.id)) continue;
    alvo.casas.push(casa.id);
    alvo.perfis.push(...perfis.filter((p) => p.casaId === casa.id).map((p) => p.id));
    alvo.agendas.push(...agendas.filter((a) => a.casaId === casa.id).map((a) => a.id));
  }
  return alvo;
}

async function restaurarEmLote(db: IDBDatabase, repos: Repositorios, bruto: DadosRestauracao, modo: ModoRestauracao): Promise<void> {
  const dados = validarRestauracao(bruto); // nada foi gravado até aqui
  const apagar = modo === "mesclar" ? await casaPadraoVaziaParaApagar(repos, new Set(dados.casas.map((c) => c.id))) : undefined;

  const tx = db.transaction([...COLECOES], "readwrite");
  const pronta = concluida(tx);
  pronta.catch(() => undefined); // a rejeição é tratada abaixo; evita aviso de promessa não tratada
  try {
    if (modo === "substituir") for (const nome of COLECOES) tx.objectStore(nome).clear();
    for (const nome of COLECOES) {
      if (nome === "estoques" && modo === "mesclar") continue;
      const loja = tx.objectStore(nome);
      for (const item of dados[nome]) loja.put(item);
    }
    if (modo === "mesclar") {
      // O estoque local do mesmo produto, com outro identificador, cede lugar ao da cópia.
      const loja = tx.objectStore("estoques");
      const porProduto = loja.index("produtoId");
      for (const e of dados.estoques) {
        const busca = porProduto.get(e.produtoId);
        busca.onsuccess = () => {
          const local = busca.result as { id: string } | undefined;
          if (local && local.id !== e.id) loja.delete(local.id);
          loja.put(e);
        };
      }
    }
    if (apagar) {
      for (const id of apagar.perfis) tx.objectStore("perfis").delete(id);
      for (const id of apagar.agendas) tx.objectStore("agendas").delete(id);
      for (const id of apagar.casas) tx.objectStore("casas").delete(id);
    }
  } catch (erro) {
    try {
      tx.abort(); // desfaz tudo o que já foi agendado
    } catch {
      /* transação já encerrada */
    }
    await pronta.catch(() => undefined);
    throw erro;
  }
  await pronta;
  for (const nome of COLECOES) emitirMudanca(nome);
}

export function criarRepositoriosComBanco(db: IDBDatabase): Repositorios {
  const casas = new ColecaoIdb<Casa>(db, "casas", sch(casaSchema));
  const perfis = new Perfis(db, "perfis", sch(perfilSchema));
  const agendas = new ColecaoIdb<AgendaIda>(db, "agendas", sch(agendaIdaSchema));
  const repos: Repositorios = {
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
    restaurar(dados, modo) {
      return restaurarEmLote(db, repos, dados, modo);
    },
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
  return repos;
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
