import type { Categoria, Mercado } from "./types";

const normalizar = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Palavras-chave por categoria, da mais específica para a mais geral (a primeira que casar vence). */
const PALAVRAS: ReadonlyArray<[Categoria, readonly string[]]> = [
  ["limpeza", ["detergente", "sabao", "desinfetante", "amaciante", "agua sanitaria", "alvejante", "esponja", "limpa ", "multiuso", "lava roupa", "lava loucas", "saco de lixo", "papel toalha"]],
  ["higiene", ["shampoo", "xampu", "condicionador", "sabonete", "creme dental", "pasta de dente", "escova dental", "papel higienico", "desodorante", "absorvente", "fralda", "fio dental", "cotonete"]],
  ["laticinios", ["leite", "queijo", "iogurte", "manteiga", "requeijao", "creme de leite", "margarina", "mussarela", "muçarela", "ricota", "nata"]],
  ["carnes", ["carne", "frango", "bife", "patinho", "acem", "linguica", "salsicha", "peixe", "tilapia", "camarao", "costela", "file", "bacon", "presunto", "mortadela", "hamburguer", "coxa", "peito de"]],
  ["bebidas", ["agua mineral", "suco", "refrigerante", "refri ", "cerveja", "vinho", "energetico", "isotonico", "cha gelado", "agua de coco"]],
  ["hortifruti", ["tomate", "cebola", "alface", "banana", "maca", "laranja", "batata", "cenoura", "limao", "mamao", "melancia", "melao", "abacaxi", "uva", "manga", "pimentao", "pepino", "coentro", "cebolinha", "alho", "repolho", "couve", "abobora", "chuchu", "goiaba", "graviola", "quiabo", "acelga", "inhame", "macaxeira", "mandioca"]],
  ["mercearia", ["arroz", "feijao", "macarrao", "acucar", "sal ", "farinha", "oleo", "azeite", "cafe", "biscoito", "bolacha", "molho", "extrato", "milho", "ervilha", "atum", "sardinha", "aveia", "granola", "cereal", "tempero", "vinagre", "maionese", "ketchup", "achocolatado", "chocolate", "pao ", "fuba", "tapioca", "lentilha"]],
];

/** Palavra-chave com espaço no fim só casa a palavra inteira; sem espaço, casa o começo de uma palavra. */
function casa(texto: string, palavra: string): boolean {
  const exata = palavra.endsWith(" ");
  const p = normalizar(palavra.trim()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${p}${exata ? "(\\s|$)" : ""}`).test(texto);
}

/**
 * Categoria inicial de um produto novo: hortifruti pelo tipo do mercado; senão por palavras-chave no
 * nome; padrão `outros`. O usuário pode editar depois.
 */
export function categoriaPorNome(nome: string, mercadoTipo: Mercado["tipo"]): Categoria {
  if (mercadoTipo === "hortifruti") return "hortifruti";
  const n = normalizar(nome).replace(/\s+/g, " ").trim();
  for (const [categoria, palavras] of PALAVRAS) {
    if (palavras.some((p) => casa(n, p))) return categoria;
  }
  return "outros";
}
