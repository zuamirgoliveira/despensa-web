// Normalização de nomes de produto: o mesmo item escrito de jeitos diferentes vira o mesmo produto.
// Função pura (sem React, sem IndexedDB). Camadas: (1) normalizar, (2) chave igual = mesmo produto,
// (3) parecido = sugestão que o usuário confirma. Nunca une produtos diferentes sozinha.
import type { Compra, Produto } from "./types";

export type Tamanho = { valor: number; medida: "g" | "ml" };

export type Normalizado = {
  /** Nome para exibir e guardar: palavras em título + tamanho canônico ("Maionese Liza 500g"). */
  nome: string;
  /** Identidade do produto: palavras sem acento, sem ordem, + tamanho. Igual = mesmo produto. */
  chave: string;
  /** Palavras que identificam o produto (sem acento, sem artigos, sem tamanho), sem repetição. */
  palavras: string[];
  tamanho?: Tamanho;
};

const ARTIGOS = new Set(["de", "da", "do", "das", "dos", "e"]);
// 500g, 500 g, 500gr, 500grs, 0,5kg, 1l, 1 lt, 2 litros, 250ml
const RE_TAMANHO = /(\d+(?:[.,]\d+)?)\s*(kg|gr?s?|gramas?|ml|lts?|litros?|l)\b/i;
// sufixos de embalagem/unidade da nota (como o suggestName antigo): "PCT 180", "UN", "KG"...
const RE_EMBALAGEM_FINAL = /\s+(pct|pc|cx|bdj|und|unid|un|kg)\b.*$/i;

const semAcento = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

function lerTamanho(numero: string, unidade: string): Tamanho {
  const n = Number(numero.replace(",", "."));
  const u = unidade.toLowerCase();
  if (u === "kg") return { valor: Math.round(n * 1000), medida: "g" };
  if (u === "ml") return { valor: Math.round(n * 1000) / 1000, medida: "ml" };
  if (u.startsWith("g")) return { valor: Math.round(n * 1000) / 1000, medida: "g" };
  return { valor: Math.round(n * 1000), medida: "ml" }; // l, lt, lts, litro(s)
}

/** "500g", "1kg", "1,5kg", "250ml", "1l": forma canônica de exibir o tamanho. */
export function formatarTamanho({ valor, medida }: Tamanho): string {
  const grande = valor >= 1000 && Number.isInteger(valor / 100);
  if (medida === "g") return grande ? `${String(valor / 1000).replace(".", ",")}kg` : `${valor}g`;
  return grande ? `${String(valor / 1000).replace(".", ",")}l` : `${valor}ml`;
}

const titulo = (palavra: string): string => (palavra ? palavra[0].toUpperCase() + palavra.slice(1) : palavra);

/**
 * Normaliza a descrição de um item da nota (ou um nome de produto já guardado: é idempotente).
 * `Maionese LIZA 500g`, `maionese liza 500 g` e `MAIONESE LIZA 500GR` dão o mesmo `nome` e a mesma `chave`.
 */
export function normalizarDescricao(descricao: string): Normalizado {
  let d = String(descricao).toLowerCase();
  let tamanho: Tamanho | undefined;
  const m = d.match(RE_TAMANHO);
  if (m) {
    tamanho = lerTamanho(m[1], m[2]);
    d = d.replace(RE_TAMANHO, " ");
  }
  d = d.replace(RE_EMBALAGEM_FINAL, "");
  d = d
    .replace(/[()[\]{}"'*+#/\\._,;:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const todas = d.split(" ").filter(Boolean);
  // artigos ficam no nome exibido ("Pão de Queijo"), mas não contam na identidade
  const palavras = [...new Set(todas.map(semAcento).filter((p) => !ARTIGOS.has(p)))];
  const base = todas.map((p) => (ARTIGOS.has(semAcento(p)) ? p : titulo(p))).join(" ");
  const nome = [base, tamanho ? formatarTamanho(tamanho) : ""].filter(Boolean).join(" ");
  const chave = `${[...palavras].sort().join(" ")}${tamanho ? `|${tamanho.valor}${tamanho.medida}` : ""}`;
  return { nome, chave, palavras, tamanho };
}

/**
 * O item vendido por unidade/pacote precisa saber o tamanho da embalagem (2 l, 350 ml, 200 g) para comparar
 * preço e contar a despensa. Falta quando o nome não traz tamanho. Item por kg/litro não precisa.
 */
export function faltaTamanho(unidadeDaNota: string, nome: string): boolean {
  return (unidadeDaNota === "UNID" || unidadeDaNota === "PCT") && normalizarDescricao(nome).tamanho === undefined;
}

/** Tamanho digitado ("2l", "350 ml", "1,5kg", "200g") em forma canônica, ou `undefined` se não for um tamanho. */
export function lerTamanhoDigitado(texto: string): Tamanho | undefined {
  const t = texto.trim();
  if (!t) return undefined;
  const n = normalizarDescricao(`x ${t}`);
  // precisa ser só o tamanho: "x" sobra como única palavra
  return n.palavras.length === 1 && n.palavras[0] === "x" ? n.tamanho : undefined;
}

/** Identidade de um nome de produto: nomes que só diferem em caixa, acento, ordem, espaços ou escrita do tamanho têm a mesma chave. */
export function chaveDeProduto(nome: string): string {
  return normalizarDescricao(nome).chave;
}

// 2 de 3 palavras em comum (ex.: "Maionese Liza" × "Maionese Liza Light"); só uma marca igual não basta
const LIMITE_PARECIDO = 0.66;

function jaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const comuns = [...A].filter((x) => B.has(x)).length;
  const uniao = A.size + B.size - comuns;
  return uniao === 0 ? 0 : comuns / uniao;
}

export type Parecido = {
  produto: Produto;
  /** 0 a 1 (palavras em comum). */
  pontos: number;
  /** `tamanho`: mesmas palavras, tamanho diferente ou ausente em um dos lados; `parecido`: palavras parecidas. */
  motivo: "tamanho" | "parecido";
};

/**
 * Produtos do catálogo que talvez sejam o mesmo que `nome` (sem contar o de chave igual, que já é o mesmo).
 * É só sugestão: quem decide é o usuário. Ordem: mais parecido primeiro, depois por nome.
 */
export function produtosParecidos(nome: string, produtos: readonly Produto[], limite = 3): Parecido[] {
  const alvo = normalizarDescricao(nome);
  const achados: Parecido[] = [];
  for (const produto of produtos) {
    if (!produto.ativo) continue;
    const outro = normalizarDescricao(produto.nome);
    if (outro.chave === alvo.chave) continue;
    const pontos = jaccard(alvo.palavras, outro.palavras);
    if (pontos === 1) achados.push({ produto, pontos, motivo: "tamanho" });
    else if (pontos >= LIMITE_PARECIDO) achados.push({ produto, pontos, motivo: "parecido" });
  }
  return achados.sort((a, b) => b.pontos - a.pontos || a.produto.nome.localeCompare(b.produto.nome, "pt-BR")).slice(0, limite);
}

export type SugestaoMesclagem = {
  origem: Produto;
  destino: Produto;
  /** `igual`: mesma chave (só escrita diferente); `tamanho` e `parecido`: como em `Parecido`. */
  motivo: "igual" | "tamanho" | "parecido";
};

/**
 * Pares do catálogo que provavelmente são o mesmo produto, para o usuário aprovar a mesclagem.
 * O destino sugerido é o produto com mais itens comprados (empate: o de nome mais curto, depois o primeiro).
 */
export function sugerirMesclagens(produtos: readonly Produto[], compras: readonly Compra[]): SugestaoMesclagem[] {
  const usos = new Map<string, number>();
  for (const c of compras) for (const i of c.itens) if (i.produtoId) usos.set(i.produtoId, (usos.get(i.produtoId) ?? 0) + 1);
  const ativos = produtos.filter((p) => p.ativo);
  const info = new Map(ativos.map((p) => [p.id, normalizarDescricao(p.nome)]));
  const ordem: Record<SugestaoMesclagem["motivo"], number> = { igual: 0, tamanho: 1, parecido: 2 };

  const escolher = (a: Produto, b: Produto): { origem: Produto; destino: Produto } => {
    const ua = usos.get(a.id) ?? 0;
    const ub = usos.get(b.id) ?? 0;
    const destinoA = ua !== ub ? ua > ub : a.nome.length !== b.nome.length ? a.nome.length < b.nome.length : true;
    return destinoA ? { origem: b, destino: a } : { origem: a, destino: b };
  };

  const sugestoes: SugestaoMesclagem[] = [];
  for (let i = 0; i < ativos.length; i++) {
    for (let j = i + 1; j < ativos.length; j++) {
      const a = ativos[i];
      const b = ativos[j];
      const na = info.get(a.id) as Normalizado;
      const nb = info.get(b.id) as Normalizado;
      let motivo: SugestaoMesclagem["motivo"] | null = null;
      if (na.chave === nb.chave) motivo = "igual";
      else {
        const pontos = jaccard(na.palavras, nb.palavras);
        if (pontos === 1) motivo = "tamanho";
        else if (pontos >= LIMITE_PARECIDO) motivo = "parecido";
      }
      if (motivo) sugestoes.push({ ...escolher(a, b), motivo });
    }
  }
  return sugestoes.sort((x, y) => ordem[x.motivo] - ordem[y.motivo] || x.destino.nome.localeCompare(y.destino.nome, "pt-BR"));
}
