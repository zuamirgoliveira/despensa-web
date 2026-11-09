// Fila de QR Codes lidos sem conseguir buscar a nota (sem internet no mercado): busca-se depois, em casa.
import { consultaDoQR } from "@/domain/nfce/sefaz";
import type { NotaPendente } from "@/domain/types";
import type { Repositorios } from "./repositorios";

export type ResultadoFila = "guardada" | "ja_importada" | "url_invalida";

/** Guarda o QR na fila (um por nota). Não guarda se a nota já foi importada. A URL é validada e reconstruída. */
export async function guardarNotaPendente(repos: Repositorios, url: string, agora: Date = new Date()): Promise<ResultadoFila> {
  const consulta = consultaDoQR(url);
  if (!consulta) return "url_invalida";
  if (await repos.compras.obter(consulta.chave)) return "ja_importada";
  const casa = await repos.iniciar();
  await repos.notasPendentes.salvar({ id: consulta.chave, casaId: casa.id, url: consulta.url, lidaEm: agora.toISOString() });
  return "guardada";
}

/** Do mais antigo para o mais novo. */
export async function listarNotasPendentes(repos: Repositorios): Promise<NotaPendente[]> {
  return (await repos.notasPendentes.listar()).sort((a, b) => a.lidaEm.localeCompare(b.lidaEm));
}

export async function removerNotaPendente(repos: Repositorios, chave: string): Promise<void> {
  await repos.notasPendentes.apagar(chave);
}
