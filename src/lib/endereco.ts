// Normalização do endereço que vem na nota (abreviado, truncado, com espaços antes de vírgula)
// para consultas de geocodificação. Função pura; testada em tests/lib/endereco.test.ts.

export type PrecisaoEndereco = "endereco" | "rua" | "bairro";

export type VarianteEndereco = {
  consulta: string;
  /** Quão preciso é o resultado esperado; "bairro" é aproximado e deve ser confirmado pelo usuário. */
  precisao: PrecisaoEndereco;
};

export type EnderecoNota = { logradouro: string; numero?: string; bairro?: string; cidade?: string; uf?: string };

const ABREVIACOES: ReadonlyArray<[RegExp, string]> = [
  [/^av\.?(?=\s|$)/i, "Avenida"],
  [/^r\.?(?=\s|$)/i, "Rua"],
  [/^trav\.?(?=\s|$)/i, "Travessa"],
  [/^tv\.?(?=\s|$)/i, "Travessa"],
  [/^estr\.?(?=\s|$)/i, "Estrada"],
  [/^rod\.?(?=\s|$)/i, "Rodovia"],
  [/^al\.?(?=\s|$)/i, "Alameda"],
  [/^pc\.?(?=\s|$)/i, "Praça"],
  [/^pça\.?(?=\s|$)/i, "Praça"],
  [/^lgo\.?(?=\s|$)/i, "Largo"],
];

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Tamanho a partir do qual o logradouro da nota provavelmente foi truncado (ex.: 40 caracteres). */
const LIMITE_TRUNCADO = 38;

const titulo = (s: string): string =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");

/** Divide "RUA X , 12 , BAIRRO , CIDADE , PE" nas partes. Aceita nota sem número. */
export function separarEndereco(texto: string): EnderecoNota | null {
  const partes = texto
    .replace(/\s+/g, " ")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length < 2) return null;
  const uf = /^[A-Za-z]{2}$/.test(partes[partes.length - 1]) ? partes.pop()!.toUpperCase() : undefined;
  const cidade = partes.length >= 2 ? partes.pop() : undefined;
  const bairro = partes.length >= 2 ? partes.pop() : undefined;
  const numero = partes.length >= 2 && /^(\d+[A-Za-z]?|s\/?n)$/i.test(partes[partes.length - 1]) ? partes.pop() : undefined;
  const logradouro = partes.join(", ");
  if (!logradouro) return null;
  return { logradouro, numero, bairro, cidade, uf };
}

function expandirLogradouro(l: string): string {
  let t = l.trim();
  for (const [re, nome] of ABREVIACOES) t = t.replace(re, nome);
  return titulo(t);
}

/**
 * Consultas em ordem da mais precisa para a mais aproximada. Quem chama tenta uma a uma e para na
 * primeira que achar resultado; "bairro" deve ser mostrado como aproximado.
 */
export function variantesDeEndereco(textoDaNota: string): VarianteEndereco[] {
  const e = separarEndereco(textoDaNota);
  if (!e) return [];
  const local = [e.bairro && titulo(e.bairro), e.cidade && titulo(e.cidade), e.uf].filter(Boolean) as string[];
  const sufixo = [...local, "Brasil"].join(", ");
  const rua = expandirLogradouro(e.logradouro);
  const out: VarianteEndereco[] = [];
  const add = (consulta: string, precisao: PrecisaoEndereco): void => {
    if (!out.some((v) => v.consulta === consulta)) out.push({ consulta, precisao });
  };

  const num = e.numero && !/^s\/?n$/i.test(e.numero) ? e.numero : undefined;
  add([rua, num, sufixo].filter(Boolean).join(", "), "endereco");

  // O texto da nota é cortado (≈ 40 caracteres): a última palavra pode estar incompleta.
  if (e.logradouro.trim().length >= LIMITE_TRUNCADO) {
    const semUltima = rua.split(" ").slice(0, -1).join(" ");
    if (semUltima.split(" ").length >= 2) add([semUltima, num, sufixo].filter(Boolean).join(", "), "endereco");
    if (semUltima.split(" ").length >= 2) add([semUltima, sufixo].join(", "), "rua");
  }
  add([rua, sufixo].join(", "), "rua");

  if (e.bairro && e.cidade) add([titulo(e.bairro), titulo(e.cidade), e.uf, "Brasil"].filter(Boolean).join(", "), "bairro");
  return out;
}
