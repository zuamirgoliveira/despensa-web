// Chave de acesso, QR Code e leitura da chave por OCR (NFC-e). Funções puras.
// Portado de referencia/prototipo/nfce.js, com o mesmo comportamento.

export const UF: Readonly<Record<number, string>> = {
  11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI",
  23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES",
  33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF",
};

export const onlyDigits = (s: unknown): string => String(s ?? "").replace(/\D/g, "");

/** Número em formato brasileiro ("1.234,56" ou "7,88") para number. */
export function parseBR(s: string): number {
  const t = String(s).trim();
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  return Number(t);
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Dígito verificador da chave (módulo 11, pesos 2 a 9, da direita para a esquerda). */
export function calcDV(key43: string): number {
  let sum = 0;
  let w = 2;
  for (let i = key43.length - 1; i >= 0; i--) {
    sum += Number(key43[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = sum % 11;
  return r === 0 || r === 1 ? 0 : 11 - r;
}

export function formatCNPJ(c: string): string {
  const d = onlyDigits(c).padStart(14, "0");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export type ChaveDecodificada =
  | {
      ok: true;
      chave: string;
      uf: string;
      ano: number;
      mes: number;
      cnpj: string;
      modelo: string;
      serie: number;
      numero: number;
      tpEmis: string;
      ehNFCe: boolean;
    }
  | { ok: false; error: string };

/** Valida (tamanho e DV) e decompõe a chave de 44 dígitos. */
export function decodeKey(raw: unknown): ChaveDecodificada {
  const k = onlyDigits(raw);
  if (k.length !== 44) {
    return { ok: false, error: `A chave tem ${k.length} dígitos, precisa ter 44.` };
  }
  const dv = calcDV(k.slice(0, 43));
  if (dv !== Number(k[43])) {
    return { ok: false, error: "Dígito verificador não confere: algum número está errado." };
  }
  const modelo = k.slice(20, 22);
  return {
    ok: true,
    chave: k,
    uf: UF[Number(k.slice(0, 2))] || k.slice(0, 2),
    ano: 2000 + Number(k.slice(2, 4)),
    mes: Number(k.slice(4, 6)),
    cnpj: k.slice(6, 20),
    modelo,
    serie: Number(k.slice(22, 25)),
    numero: Number(k.slice(25, 34)),
    tpEmis: k[34],
    ehNFCe: modelo === "65",
  };
}

/** Extrai a chave de 44 dígitos do conteúdo de um QR Code de NFC-e (v1 ou v2). */
export function keyFromQR(text: unknown): string | null {
  const t = String(text);
  const m = t.match(/(?<!\d)(\d{44})(?!\d)/) || t.replace(/\s/g, "").match(/(\d{44})/);
  return m ? m[1] : null;
}

/** Confere os dois dígitos verificadores de um CNPJ (14 dígitos). */
export function cnpjOk(c: unknown): boolean {
  const d = onlyDigits(c);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dig = (base: string, pesos: number[]): number => {
    const s = base.split("").reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  const d1 = dig(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dig(d.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/**
 * Chave plausível: 44 dígitos, DV ok, modelo 65, UF conhecida, ano 2019 a 2040,
 * mês 1 a 12, tpEmis 1 ou 9 e CNPJ válido.
 */
export function chavePlausivel(k: string): boolean {
  const r = decodeKey(k);
  return (
    r.ok &&
    r.ehNFCe &&
    !!UF[Number(k.slice(0, 2))] &&
    r.ano >= 2019 &&
    r.ano <= 2040 &&
    r.mes >= 1 &&
    r.mes <= 12 &&
    (r.tpEmis === "1" || r.tpEmis === "9") &&
    cnpjOk(r.cnpj)
  );
}

// Troca típica do OCR em papel térmico: dígito lido -> dígitos que podem ser o verdadeiro.
const CONFUSAO: Readonly<Record<string, string>> = {
  0: "86", 1: "7", 2: "7", 3: "85", 4: "9", 5: "639", 6: "580", 7: "12", 8: "0369", 9: "840",
};

export type Candidata = { chave: string; trocas: number };

/** Uma correção de um dígito: posição 1 a 44, dígito atual e dígito proposto. */
export type Correcao = { chave: string; posicao: number; de: string; para: string };

/**
 * Para uma chave de 44 dígitos com dígito verificador errado (ex.: digitada com um número trocado):
 * as trocas de **um** dígito, por confusões típicas de leitura (tabela do OCR), que a tornam válida.
 * São sugestões para o usuário conferir no papel: nunca são aplicadas sozinhas.
 */
export function correcoesDeUmDigito(chave: string): Correcao[] {
  const s = onlyDigits(chave);
  if (s.length !== 44 || chavePlausivel(s)) return [];
  const out: Correcao[] = [];
  for (let i = 0; i < 44; i++) {
    for (const c of CONFUSAO[s[i]] || "") {
      const nova = troca(s, i, c);
      if (chavePlausivel(nova)) out.push({ chave: nova, posicao: i + 1, de: s[i], para: c });
    }
  }
  return out;
}

const troca = (str: string, i: number, c: string): string => str.slice(0, i) + c + str.slice(i + 1);

function variacoes(s: string): Candidata[] {
  const out: Candidata[] = [];
  for (let i = 0; i < s.length; i++) {
    for (const c of CONFUSAO[s[i]] || "") out.push({ chave: troca(s, i, c), trocas: 1 });
  }
  return out;
}

function variacoes2(s: string): Candidata[] {
  const out: Candidata[] = [];
  for (let i = 0; i < s.length; i++) {
    for (const c of CONFUSAO[s[i]] || "") {
      const a = troca(s, i, c);
      for (let j = i + 1; j < s.length; j++) {
        for (const c2 of CONFUSAO[s[j]] || "") out.push({ chave: troca(a, j, c2), trocas: 2 });
      }
    }
  }
  return out;
}

export type ResultadoOCR =
  | { exata: string }
  | { candidatas: Candidata[] }
  /** `aproximada`: leitura crua (sem validar) da linha mais parecida com a chave; só para o usuário corrigir à mão. */
  | { vazio: true; ambiguo?: true; aproximada?: string };

const ATE_DIGITOS_APROXIMADA = 52;
const MIN_DIGITOS_APROXIMADA = 36;

/**
 * Linha do texto do OCR que mais se parece com a chave (36 a 52 dígitos, a mais próxima de 44).
 * Devolve os grupos **como o OCR os leu**, separados por espaço (um grupo com mais ou menos de 4
 * dígitos mostra onde o leitor errou). NÃO é uma chave válida: serve só para o usuário conferir
 * com a nota e corrigir dígito por dígito.
 */
export function leituraAproximada(texto: string): string | null {
  let melhor: { grupos: string[]; n: number } | null = null;
  for (const linha of String(texto).split("\n")) {
    const grupos = linha.split(/\s+/).map(onlyDigits).filter((g) => g.length > 0);
    const n = grupos.reduce((s, g) => s + g.length, 0);
    if (n < MIN_DIGITOS_APROXIMADA || n > ATE_DIGITOS_APROXIMADA) continue;
    if (melhor === null || Math.abs(n - 44) < Math.abs(melhor.n - 44)) melhor = { grupos, n };
  }
  return melhor ? melhor.grupos.join(" ") : null;
}

/**
 * Procura a chave no texto devolvido pelo OCR.
 * `exata`: chave válida como veio. `candidatas`: foi preciso corrigir dígitos (o usuário
 * escolhe). `vazio`: nada achado (`ambiguo` quando há candidatas demais).
 * Nunca devolve como exata uma chave que não passou em `chavePlausivel`.
 */
export function chaveDoOCR(texto: string, cnpjsConhecidos: readonly string[] = []): ResultadoOCR {
  const linhas = String(texto).split("\n").map((l) => onlyDigits(l));
  const todos = linhas.join("");

  // 1) alguma janela de 44 dígitos já é uma chave válida?
  for (let i = 0; i + 44 <= todos.length; i++) {
    const j = todos.slice(i, i + 44);
    if (chavePlausivel(j)) return { exata: j };
  }

  // 2) blocos de linhas numéricas consecutivas (a chave costuma quebrar em 2 linhas)
  const blocos: string[] = [];
  let atual = "";
  for (const l of linhas) {
    if (l.length >= 8) atual += l;
    else if (atual) {
      blocos.push(atual);
      atual = "";
    }
  }
  if (atual) blocos.push(atual);

  const base = new Map<string, number>(); // possível chave -> ajustes já feitos
  const add = (v: string, custo: number): void => {
    const c = base.get(v);
    if (c === undefined || c > custo) base.set(v, custo);
  };
  for (const b of blocos) {
    if (b.length === 44) add(b, 0);
    if (b.length === 45) for (let i = 0; i < 45; i++) add(b.slice(0, i) + b.slice(i + 1), 1); // dígito a mais
    if (b.length === 43) {
      for (let i = 0; i <= 43; i++) for (let d = 0; d < 10; d++) add(b.slice(0, i) + d + b.slice(i), 1); // a menos
    }
    if (b.length > 45) {
      // chave junto com outros números: janelas que começam por UF conhecida
      for (let i = 0; i + 44 <= b.length; i++) if (UF[Number(b.slice(i, i + 2))]) add(b.slice(i, i + 44), 0);
    }
  }

  const achadas = new Map<string, Candidata>();
  const consider = (lista: Candidata[]): void => {
    for (const v of lista) if (chavePlausivel(v.chave) && !achadas.has(v.chave)) achadas.set(v.chave, v);
  };
  // Da correção mais simples para a mais ousada; para na primeira etapa que achar algo.
  for (const [b, custo] of base) if (custo > 0) consider([{ chave: b, trocas: custo }]);
  if (!achadas.size) {
    for (const [b, custo] of base) consider(variacoes(b).map((v) => ({ ...v, trocas: v.trocas + custo })));
  }
  if (!achadas.size) {
    // Duas trocas geram muitas chaves "válidas" por acaso (o DV só descarta 10 de cada 11).
    // Com mercado já conhecido, prefere esse CNPJ.
    for (const [b, custo] of base) consider(variacoes2(b).map((v) => ({ ...v, trocas: v.trocas + custo })));
    const conhecidas = [...achadas.values()].filter((v) => {
      const d = decodeKey(v.chave);
      return d.ok && cnpjsConhecidos.includes(d.cnpj);
    });
    if (conhecidas.length) {
      achadas.clear();
      for (const v of conhecidas) achadas.set(v.chave, v);
    }
  }

  if (!achadas.size) return { vazio: true };
  if (achadas.size > 3) return { vazio: true, ambiguo: true };
  const pontos = (v: Candidata): number => {
    const k = decodeKey(v.chave);
    if (!k.ok) return v.trocas;
    return (cnpjsConhecidos.includes(k.cnpj) ? -10 : 0) + (k.uf === "PE" ? -2 : 0) + v.trocas;
  };
  const candidatas = [...achadas.values()].sort((a, b) => pontos(a) - pontos(b)).slice(0, 3);
  return { candidatas };
}
