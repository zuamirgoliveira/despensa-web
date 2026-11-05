import { criarRepositorios } from "@/data";
import { guardarCopia, type AmbienteArquivo, type OpcoesCopia, type ResultadoCopia } from "@/data/backupArquivo";
import { baixarArquivo, compartilharArquivo, criarArquivo } from "@/lib/arquivos";

const ambienteDoNavegador: AmbienteArquivo = {
  criar: (conteudo, nome) => criarArquivo(conteudo, nome),
  compartilhar: (arquivo, titulo) => compartilharArquivo(arquivo, titulo),
  baixar: (arquivo) => baixarArquivo(arquivo),
};

/** Guarda a cópia de segurança com o menu de compartilhar do aparelho (ou baixando o arquivo). */
export async function guardarCopiaNoNavegador(opcoes: OpcoesCopia = {}): Promise<ResultadoCopia> {
  return guardarCopia(await criarRepositorios(), ambienteDoNavegador, opcoes);
}

const ROTULOS: Record<string, [singular: string, plural: string]> = {
  compras: ["compra", "compras"],
  produtos: ["produto", "produtos"],
  mercados: ["mercado", "mercados"],
  apelidos: ["apelido", "apelidos"],
};

/** `{ compras: 1, produtos: 8 }` → "1 compra, 8 produtos, ..." (só o que o usuário reconhece). */
export function descreverContagens(contagens: Record<string, number>): string {
  return Object.entries(ROTULOS)
    .map(([k, [um, varios]]) => `${contagens[k] ?? 0} ${(contagens[k] ?? 0) === 1 ? um : varios}`)
    .join(", ");
}
