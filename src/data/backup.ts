// Exportar e importar backup em JSON, com validação Zod de todo o arquivo.
import { z } from "zod";
import { converterEstoqueLegado, type EstoqueLegado } from "@/domain/despensa";
import type { Compra } from "@/domain/types";
import {
  agendaIdaSchema,
  apelidoMercadoSchema,
  casaSchema,
  compraSchema,
  conferenciaSchema,
  notaPendenteSchema,
  estoqueSchema,
  instanteSchema,
  itemListaSchema,
  listaSchema,
  mercadoSchema,
  perfilSchema,
  produtoSchema,
} from "@/schemas";
import type { ModoRestauracao, Repositorios } from "./repositorios";

/** Versão do formato do arquivo. A 1 não tinha `meta`; a 2 acrescenta contagens, período e integridade. */
export const VERSAO_BACKUP = 3;

/** Cabeçalho do arquivo (v2): o que há dentro e uma soma para detectar arquivo cortado ou alterado. */
export const metaBackupSchema = z.object({
  app: z.string().optional(),
  incluiPosicaoDeCasa: z.boolean(),
  contagens: z.record(z.string(), z.number().int().nonnegative()),
  periodo: z.object({ de: z.string(), ate: z.string() }).optional(),
  integridade: z.object({ algoritmo: z.literal("SHA-256"), valor: z.string().regex(/^[0-9a-f]{64}$/) }),
});
export type MetaBackup = z.infer<typeof metaBackupSchema>;

export const backupSchema = z.object({
  versao: z.number().int().min(1),
  exportadoEm: instanteSchema,
  /** Ausente nos arquivos da versão 1. */
  meta: metaBackupSchema.optional(),
  colecoes: z.object({
    casas: z.array(casaSchema),
    perfis: z.array(perfilSchema),
    agendas: z.array(agendaIdaSchema),
    mercados: z.array(mercadoSchema),
    produtos: z.array(produtoSchema),
    apelidos: z.array(apelidoMercadoSchema),
    estoques: z.array(estoqueSchema),
    compras: z.array(compraSchema),
    listas: z.array(listaSchema),
    itensLista: z.array(itemListaSchema),
    /** Ausente em backups anteriores à C-23. */
    conferencias: z.array(conferenciaSchema).default([]),
    notasPendentes: z.array(notaPendenteSchema).default([]),
  }),
});

export type Backup = z.infer<typeof backupSchema>;
export type ResumoImportacao = Record<keyof Backup["colecoes"], number>;

export class BackupInvalidoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "BackupInvalidoError";
  }
}

export type OpcoesExportacao = {
  /** Padrão: true. Com false, o arquivo sai sem as coordenadas da casa. */
  incluirPosicaoDeCasa?: boolean;
};

/** SHA-256 em hexadecimal (Web Crypto: exige HTTPS ou localhost, como o resto do PWA). */
export async function sha256Hex(texto: string): Promise<string> {
  const h = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const contar = (colecoes: Record<string, readonly unknown[]>): Record<string, number> =>
  Object.fromEntries(Object.entries(colecoes).map(([k, v]) => [k, v.length]));

/** Menor e maior data de emissão (AAAA-MM-DD) entre as compras, ou `undefined` sem compras. */
function periodoDasCompras(compras: readonly { emissao: string }[]): { de: string; ate: string } | undefined {
  if (!compras.length) return undefined;
  const datas = compras.map((c) => c.emissao.slice(0, 10)).sort();
  return { de: datas[0], ate: datas[datas.length - 1] };
}

export async function exportar(repos: Repositorios, agora: Date = new Date(), opcoes: OpcoesExportacao = {}): Promise<Backup> {
  const incluirPosicaoDeCasa = opcoes.incluirPosicaoDeCasa ?? true;
  const [casas, perfis, agendas, mercados, produtos, apelidos, estoques, compras, listas, itensLista, conferencias, notasPendentes] =
    await Promise.all([
      repos.casas.listar(),
      repos.perfis.listar(),
      repos.agendas.listar(),
      repos.mercados.listar(),
      repos.produtos.listar(),
      repos.apelidos.listar(),
      repos.estoques.listar(),
      repos.compras.listar(),
      repos.listas.listar(),
      repos.itensLista.listar(),
      repos.conferencias.listar(),
      repos.notasPendentes.listar(),
    ]);
  const colecoes = {
    casas,
    perfis: incluirPosicaoDeCasa ? perfis : perfis.map((p) => ({ ...p, localizacaoCasa: undefined })),
    agendas,
    mercados,
    produtos,
    apelidos,
    estoques,
    compras,
    listas,
    itensLista,
    conferencias,
    notasPendentes,
  };
  return {
    versao: VERSAO_BACKUP,
    exportadoEm: agora.toISOString(),
    meta: {
      app: "despensa-web",
      incluiPosicaoDeCasa: incluirPosicaoDeCasa && perfis.some((p) => p.localizacaoCasa !== undefined),
      contagens: contar(colecoes),
      periodo: periodoDasCompras(compras),
      integridade: { algoritmo: "SHA-256", valor: await sha256Hex(JSON.stringify(colecoes)) },
    },
    colecoes,
  };
}

export type SituacaoIntegridade = "ok" | "falhou" | "ausente";

export type InspecaoBackup = {
  backup: Backup;
  versao: number;
  exportadoEm: string;
  /** Contadas nos dados (não confiam no cabeçalho). */
  contagens: ResumoImportacao;
  periodo?: { de: string; ate: string };
  /** Há coordenadas de casa nos dados da cópia. */
  temPosicaoDeCasa: boolean;
  /** `ausente`: arquivo da v1, sem soma. `falhou`: soma ou contagens não conferem (arquivo cortado ou alterado). */
  integridade: SituacaoIntegridade;
};

/**
 * Lê e confere um arquivo de backup **sem gravar nada**: formato, versão, soma de verificação e contagens.
 * Lança `BackupInvalidoError` para JSON quebrado, formato desconhecido ou versão mais nova que a suportada.
 */
export async function inspecionarBackup(json: string): Promise<InspecaoBackup> {
  const backup = lerBackup(json);
  const bruto = JSON.parse(json) as { colecoes?: unknown };
  const contagens = contar(backup.colecoes) as ResumoImportacao;
  let integridade: SituacaoIntegridade = "ausente";
  if (backup.meta) {
    const somaOk = (await sha256Hex(JSON.stringify(bruto.colecoes))) === backup.meta.integridade.valor;
    const contagensOk = Object.entries(backup.meta.contagens).every(([k, v]) => contagens[k as keyof ResumoImportacao] === v);
    integridade = somaOk && contagensOk ? "ok" : "falhou";
  }
  return {
    backup,
    versao: backup.versao,
    exportadoEm: backup.exportadoEm,
    contagens,
    periodo: periodoDasCompras(backup.colecoes.compras),
    temPosicaoDeCasa: backup.colecoes.perfis.some((p) => p.localizacaoCasa !== undefined),
    integridade,
  };
}

/**
 * Backups v1 e v2 guardam o estoque só por nível. Antes da validação, acrescenta `quantidade`
 * (nível × padrão; ver `converterEstoqueLegado`). A soma de verificação segue sobre o texto original.
 */
function converterEstoquesLegados(bruto: unknown): unknown {
  const col = (bruto as { colecoes?: Record<string, unknown> } | null)?.colecoes;
  if (!col || !Array.isArray(col.estoques)) return bruto;
  const produtos = new Map((Array.isArray(col.produtos) ? (col.produtos as { id: string; meta: number }[]) : []).map((p) => [p.id, p]));
  const compras = (Array.isArray(col.compras) ? col.compras : []) as Compra[];
  const estoques = (col.estoques as EstoqueLegado[]).map((e) =>
    e && typeof e === "object" && typeof e.nivel === "string" ? converterEstoqueLegado(e, produtos.get(e.produtoId), compras) : e,
  );
  return { ...(bruto as object), colecoes: { ...col, estoques } };
}

/** Valida o texto do arquivo sem gravar nada. Lança BackupInvalidoError com mensagem clara. */
export function lerBackup(json: string): Backup {
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    throw new BackupInvalidoError("O arquivo não é um JSON válido.");
  }
  const versao = (bruto as { versao?: unknown } | null)?.versao;
  if (typeof versao === "number" && versao > VERSAO_BACKUP) {
    throw new BackupInvalidoError(
      `Este backup é da versão ${versao}, mais nova que a suportada (${VERSAO_BACKUP}). Atualize o app.`,
    );
  }
  const r = backupSchema.safeParse(versao === undefined || (typeof versao === "number" && versao < 3) ? converterEstoquesLegados(bruto) : bruto);
  if (!r.success) {
    const p = r.error.issues[0];
    throw new BackupInvalidoError(`Arquivo de backup inválido em "${p.path.join(".") || "raiz"}": ${p.message}`);
  }
  return r.data;
}

export type { ModoRestauracao } from "./repositorios";

/**
 * Restaura uma cópia **de forma atômica** (`Repositorios.restaurar`): entra tudo ou nada.
 * Recusa arquivo cuja soma de verificação não confere. Em `mesclar`, a posição de casa deste aparelho
 * é mantida se a cópia não a traz; nos dois modos `Perfil.ultimoBackupEm` passa a ser a data da cópia.
 */
export async function restaurarBackup(repos: Repositorios, json: string, modo: ModoRestauracao): Promise<ResumoImportacao> {
  const inspecao = await inspecionarBackup(json);
  if (inspecao.integridade === "falhou") {
    throw new BackupInvalidoError("O arquivo está incompleto ou foi alterado depois de gerado. Faça uma nova cópia de segurança.");
  }
  const locais = modo === "mesclar" ? await repos.perfis.listar() : [];
  const perfis = inspecao.backup.colecoes.perfis.map((p) => {
    const local = locais.find((l) => l.id === p.id);
    const maisNovo = local?.ultimoBackupEm && local.ultimoBackupEm > inspecao.exportadoEm ? local.ultimoBackupEm : inspecao.exportadoEm;
    return { ...p, localizacaoCasa: p.localizacaoCasa ?? local?.localizacaoCasa, ultimoBackupEm: maisNovo };
  });
  await repos.restaurar({ ...inspecao.backup.colecoes, perfis }, modo);
  await repos.iniciar(); // cópia sem casa: recria a casa padrão
  return inspecao.contagens;
}

/** Importação idempotente: registros com o mesmo id/chave ficam como na cópia; o resto do aparelho é mantido. */
export function importar(repos: Repositorios, json: string): Promise<ResumoImportacao> {
  return restaurarBackup(repos, json, "mesclar");
}

export type ContagemComparada = {
  /** Existem só neste aparelho (a mesclagem os mantém; "substituir" os apaga). */
  soAqui: number;
  /** Na cópia e também aqui (ficam como na cópia). */
  nosDois: number;
  /** Na cópia e não aqui. */
  soNaCopia: number;
};

export type ComparacaoAparelho = {
  /** Sem compras, produtos nem mercados: só a casa padrão recém-criada. */
  vazio: boolean;
  contagens: ResumoImportacao;
  compras: ContagemComparada;
  produtos: ContagemComparada;
  mercados: ContagemComparada;
  /** A cópia é anterior à última compra importada neste aparelho: restaurar pode perder compras recentes. */
  copiaMaisAntiga: boolean;
  /** Este aparelho tem dados e nenhuma casa da cópia é a dele: mesclar deixaria duas casas. */
  outraCasa: boolean;
};

function comparar(locais: readonly string[], copia: readonly string[]): ContagemComparada {
  const aqui = new Set(locais);
  const naCopia = new Set(copia);
  const nosDois = [...naCopia].filter((c) => aqui.has(c)).length;
  return { soAqui: aqui.size - nosDois, nosDois, soNaCopia: naCopia.size - nosDois };
}

/** O que existe hoje neste aparelho em relação à cópia (para o usuário decidir entre mesclar e substituir). */
export async function compararComAparelho(repos: Repositorios, inspecao: InspecaoBackup): Promise<ComparacaoAparelho> {
  const [casas, perfis, agendas, mercados, produtos, apelidos, estoques, compras, listas, itensLista, conferencias, notasPendentes] = await Promise.all([
    repos.casas.listar(),
    repos.perfis.listar(),
    repos.agendas.listar(),
    repos.mercados.listar(),
    repos.produtos.listar(),
    repos.apelidos.listar(),
    repos.estoques.listar(),
    repos.compras.listar(),
    repos.listas.listar(),
    repos.itensLista.listar(),
    repos.conferencias.listar(),
    repos.notasPendentes.listar(),
  ]);
  const c = inspecao.backup.colecoes;
  const contagens = contar({ casas, perfis, agendas, mercados, produtos, apelidos, estoques, compras, listas, itensLista, conferencias, notasPendentes }) as ResumoImportacao;
  const vazio = compras.length === 0 && produtos.length === 0 && mercados.length === 0;
  const ultimaImportacao = compras.map((x) => x.importadoEm).sort().pop();
  return {
    vazio,
    contagens,
    compras: comparar(compras.map((x) => x.chave), c.compras.map((x) => x.chave)),
    produtos: comparar(produtos.map((x) => x.id), c.produtos.map((x) => x.id)),
    mercados: comparar(mercados.map((x) => x.id), c.mercados.map((x) => x.id)),
    copiaMaisAntiga: ultimaImportacao !== undefined && inspecao.exportadoEm < ultimaImportacao,
    outraCasa: !vazio && !casas.some((x) => c.casas.some((y) => y.id === x.id)),
  };
}
