// Exportar e importar backup em JSON, com validação Zod de todo o arquivo.
import { z } from "zod";
import {
  agendaIdaSchema,
  apelidoMercadoSchema,
  casaSchema,
  compraSchema,
  estoqueSchema,
  instanteSchema,
  itemListaSchema,
  listaSchema,
  mercadoSchema,
  perfilSchema,
  produtoSchema,
} from "@/schemas";
import type { Repositorios } from "./repositorios";

export const VERSAO_BACKUP = 1;

export const backupSchema = z.object({
  versao: z.number().int().min(1),
  exportadoEm: instanteSchema,
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

export async function exportar(repos: Repositorios, agora: Date = new Date()): Promise<Backup> {
  const [casas, perfis, agendas, mercados, produtos, apelidos, estoques, compras, listas, itensLista] =
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
    ]);
  return {
    versao: VERSAO_BACKUP,
    exportadoEm: agora.toISOString(),
    colecoes: { casas, perfis, agendas, mercados, produtos, apelidos, estoques, compras, listas, itensLista },
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
