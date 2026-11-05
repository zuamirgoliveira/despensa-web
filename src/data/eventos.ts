// Emissor de mudanças dos repositórios. Sem store global: cada escrita emite o nome da coleção.

export const COLECOES = [
  "casas",
  "perfis",
  "agendas",
  "mercados",
  "produtos",
  "apelidos",
  "estoques",
  "compras",
  "listas",
  "itensLista",
] as const;

export type NomeColecao = (typeof COLECOES)[number];
type Ouvinte = (colecao: NomeColecao) => void;

const ouvintes = new Set<Ouvinte>();

/** Registra um ouvinte de mudanças. Devolve a função que cancela o registro. */
export function aoMudar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function emitirMudanca(colecao: NomeColecao): void {
  for (const o of [...ouvintes]) o(colecao);
}
