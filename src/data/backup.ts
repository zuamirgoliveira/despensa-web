// Exportar e importar backup em JSON, com validação Zod de todo o arquivo.
import { z } from "zod";
import {
  agendaIdaSchema,
  apelidoMercadoSchema,
  casaSchema,
  compraSchema,
  conferenciaSchema,
  estoqueSchema,
  instanteSchema,
  itemListaSchema,
  listaSchema,
  mercadoSchema,
  perfilSchema,
  produtoSchema,
} from "@/schemas";
import type { Repositorios } from "./repositorios";

/** Versão do formato do arquivo. A 1 não tinha `meta`; a 2 acrescenta contagens, período e integridade. */
export const VERSAO_BACKUP = 2;

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
  const [casas, perfis, agendas, mercados, produtos, apelidos, estoques, compras, listas, itensLista, conferencias] =
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
  const r = backupSchema.safeParse(bruto);
  if (!r.success) {
    const p = r.error.issues[0];
    throw new BackupInvalidoError(`Arquivo de backup inválido em "${p.path.join(".") || "raiz"}": ${p.message}`);
  }
  return r.data;
}

/** Importação idempotente: registros com o mesmo id/chave são sobrescritos. */
export async function importar(repos: Repositorios, json: string): Promise<ResumoImportacao> {
  const { colecoes } = lerBackup(json);
  for (const x of colecoes.casas) await repos.casas.salvar(x);
  for (const x of colecoes.perfis) await repos.perfis.salvar(x);
  for (const x of colecoes.agendas) await repos.agendas.salvar(x);
  for (const x of colecoes.mercados) await repos.mercados.salvar(x);
  for (const x of colecoes.produtos) await repos.produtos.salvar(x);
  for (const x of colecoes.apelidos) await repos.apelidos.salvar(x);
  for (const x of colecoes.estoques) await repos.estoques.salvar(x);
  for (const x of colecoes.compras) await repos.compras.salvar(x);
  for (const x of colecoes.listas) await repos.listas.salvar(x);
  for (const x of colecoes.itensLista) await repos.itensLista.salvar(x);
  for (const x of colecoes.conferencias) await repos.conferencias.salvar(x);
  await removerCasaPadraoVazia(repos, new Set(colecoes.casas.map((c) => c.id)));
  return Object.fromEntries(Object.entries(colecoes).map(([k, v]) => [k, v.length])) as ResumoImportacao;
}

/**
 * Ao restaurar em um aparelho novo, a casa padrão criada na primeira abertura (com perfil e agenda
 * iniciais) ainda está vazia. Remove-a para não ficar com duas casas (`iniciar` usa a primeira).
 */
async function removerCasaPadraoVazia(repos: Repositorios, idsImportados: ReadonlySet<string>): Promise<void> {
  if (idsImportados.size === 0) return;
  const [compras, produtos, mercados] = await Promise.all([repos.compras.listar(), repos.produtos.listar(), repos.mercados.listar()]);
  for (const casa of await repos.casas.listar()) {
    if (idsImportados.has(casa.id)) continue;
    const temDados = [...compras, ...produtos, ...mercados].some((x) => x.casaId === casa.id);
    if (temDados) continue;
    for (const p of await repos.perfis.listar()) if (p.casaId === casa.id) await repos.perfis.apagar(p.id);
    for (const a of await repos.agendas.listar()) if (a.casaId === casa.id) await repos.agendas.apagar(a.id);
    await repos.casas.apagar(casa.id);
  }
}
