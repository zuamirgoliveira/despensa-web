// Parser do texto da NFC-e copiado da página de consulta da SEFAZ-PE.
// Portado de referencia/prototipo/nfce.js. Valores monetários em centavos.
// Nunca guarda CPF nem o texto bruto: só sinaliza `cpfNaNota`.

import { z } from "zod";
import { UNIDADES_NOTA } from "@/schemas/constantes";
import { decodeKey, onlyDigits, parseBR } from "./chave";

export const itemNotaSchema = z.object({
  descricao: z.string().min(1),
  codigo: z.string().min(1),
  quantidade: z.number().nonnegative(),
  unidade: z.enum(UNIDADES_NOTA),
  valorUnitarioCentavos: z.number().int(),
  valorTotalCentavos: z.number().int(),
});

export const notaParseadaSchema = z.object({
  loja: z.object({ nome: z.string(), cnpj: z.string(), endereco: z.string() }),
  itens: z.array(itemNotaSchema),
  numero: z.number().int().nullable(),
  serie: z.number().int().nullable(),
  /** YYYY-MM-DDTHH:mm:ss, local, sem fuso. */
  emissao: z.string().nullable(),
  protocolo: z.string().nullable(),
  chave: z.string().nullable(),
  totalItens: z.number().int().nullable(),
  valorPagarCentavos: z.number().int().nullable(),
  somaItensCentavos: z.number().int(),
  pagamento: z.string().nullable(),
  cpfNaNota: z.boolean(),
});

export type ItemNota = z.infer<typeof itemNotaSchema>;
export type NotaParseada = z.infer<typeof notaParseadaSchema>;
export type ResultadoParser = { nota: NotaParseada; avisos: string[]; erros: string[] };

const TOLERANCIA_TOTAL_CENTAVOS = 5;
const TOLERANCIA_LINHA_CENTAVOS = 2;

const centavos = (valor: number): number => Math.round(valor * 100);
const brl = (c: number): string => "R$ " + (c / 100).toFixed(2).replace(".", ",");

export const UNIDADES_ALIAS: Readonly<Record<string, ItemNota["unidade"]>> = {
  KG: "KG", UNID: "UNID", UN: "UNID", UND: "UNID", L: "L", LT: "L", LITRO: "L", PCT: "PCT", PC: "PCT",
};

/** Sugere um nome de produto a partir da descrição da nota (sem unidade no fim). */
export function suggestName(desc: string): string {
  let d = String(desc).trim().toLowerCase();
  d = d.replace(/\s+(pct|cx|bdj|und|unid|un|kg)\b.*$/i, "");
  d = d.replace(/\s+/g, " ").trim();
  return d.replace(/(^|\s)([a-zà-ú])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

export type Embalagem = {
  tipo: "pct" | "cx" | "bdj" | "un";
  /** Tamanho na menor unidade: gramas, mililitros ou, sem medida explícita, o número como veio. */
  tamanho: number;
  /** Presente quando a descrição traz a medida (g, ml). Ausente em "PCT 180" (assumido gramas na C-31). */
  medida?: "g" | "ml";
};

/** Extrai o tamanho da embalagem da descrição (ex.: `ALHO REDINHA PCT 180`). */
export function extrairEmbalagem(descricao: string): Embalagem | null {
  const d = String(descricao).toLowerCase();
  const num = (s: string): number => Number(s.replace(",", "."));
  const medidaDe = (n: number, m: string | undefined): Pick<Embalagem, "tamanho" | "medida"> => {
    if (!m) return { tamanho: n };
    if (m === "kg") return { tamanho: Math.round(n * 1000), medida: "g" };
    if (m === "l") return { tamanho: Math.round(n * 1000), medida: "ml" };
    return { tamanho: n, medida: m === "ml" ? "ml" : "g" };
  };

  const a = d.match(/\b(pct|cx|bdj|pc|und|un)\s*(\d+(?:[.,]\d+)?)\s*(gr?|ml|kg|l)?\b/);
  if (a) {
    const tipo = a[1] === "pc" ? "pct" : a[1] === "und" ? "un" : (a[1] as Embalagem["tipo"]);
    return { tipo, ...medidaDe(num(a[2]), a[3]?.replace(/^gr$/, "g")) };
  }
  const b = d.match(/\b(\d+(?:[.,]\d+)?)\s*(gr?|ml|kg|l)\b/);
  if (b) return { tipo: "un", ...medidaDe(num(b[1]), b[2].replace(/^gr$/, "g")) };
  return null;
}

/** Conferências comuns ao texto colado e ao XML: data, totais, linhas, chave × CNPJ/número e formato. Erros impedem salvar. */
export function conferirNota(nota: NotaParseada, avisos: string[], erros: string[]): void {
  const { itens, loja, somaItensCentavos } = nota;
  if (!nota.emissao) erros.push("Não encontrei a data de emissão.");

  // Conferências
  if (nota.valorPagarCentavos != null && itens.length) {
    const dif = somaItensCentavos - nota.valorPagarCentavos;
    if (Math.abs(dif) > TOLERANCIA_TOTAL_CENTAVOS) {
      avisos.push(
        `A soma dos itens (${brl(somaItensCentavos)}) difere do valor a pagar (${brl(nota.valorPagarCentavos)}). Pode haver desconto ou item faltando.`,
      );
    }
  } else if (itens.length) {
    avisos.push("Não encontrei o valor a pagar para conferir o total.");
  }
  if (nota.totalItens != null && nota.totalItens !== itens.length) {
    erros.push(`A nota informa ${nota.totalItens} itens, mas li ${itens.length}.`);
  }
  for (const i of itens) {
    const esperado = Math.round(i.quantidade * i.valorUnitarioCentavos);
    if (Math.abs(esperado - i.valorTotalCentavos) > TOLERANCIA_LINHA_CENTAVOS) {
      avisos.push(
        `${i.descricao}: ${String(i.quantidade).replace(".", ",")} × ${brl(i.valorUnitarioCentavos)} = ${brl(esperado)}, mas a nota diz ${brl(i.valorTotalCentavos)}.`,
      );
    }
  }

  if (nota.chave) {
    const k = decodeKey(nota.chave);
    if (!k.ok) erros.push(`Chave de acesso no texto inválida: ${k.error}`);
    else {
      if (loja.cnpj && k.cnpj !== loja.cnpj) erros.push("O CNPJ da chave não bate com o CNPJ do mercado no texto.");
      if (nota.numero != null && k.numero !== nota.numero) erros.push("O número da nota não bate com a chave.");
      if (!k.ehNFCe) avisos.push("A chave não é de NFC-e (modelo 65).");
    }
  } else {
    avisos.push("Não encontrei a chave de acesso no texto; não dá para evitar importar a mesma nota duas vezes.");
  }

  const valida = notaParseadaSchema.safeParse(nota);
  if (!valida.success) erros.push("A nota lida está em formato inesperado.");
}

const RE_ITEM =
  /([^\n]+?)\s*\(C[óo]digo:\s*(\d+)\)\s*Qtde\.:\s*([\d.,]+)\s+UN:\s*(\S+)\s+Vl\.\s*Unit\.:\s*([\d.,]+)\s*Vl\.\s*Total\s*([\d.,]+)/g;

/**
 * Lê o texto copiado da página de consulta da NFC-e.
 * Erros impedem salvar; avisos pedem atenção.
 */
export function parseNota(texto: unknown): ResultadoParser {
  const avisos: string[] = [];
  const erros: string[] = [];
  const t = String(texto ?? "").replace(/\r/g, "").replace(/\u00a0/g, " ");
  const linhas = t.split("\n").map((l) => l.trim());

  // Mercado
  const iCnpj = linhas.findIndex((l) => /^CNPJ:/i.test(l));
  const loja = { nome: "", cnpj: "", endereco: "" };
  if (iCnpj >= 0) {
    loja.cnpj = onlyDigits(linhas[iCnpj]);
    for (let i = iCnpj - 1; i >= 0; i--) {
      if (linhas[i]) {
        loja.nome = linhas[i];
        break;
      }
    }
    const end = linhas[iCnpj + 1];
    if (end && !/^filtrar itens/i.test(end)) loja.endereco = end.replace(/\s+,/g, ",").replace(/,\s+/g, ", ");
  } else {
    erros.push("Não encontrei o CNPJ do mercado. O texto colado é da página da nota?");
  }

  // Itens
  const itens: ItemNota[] = [];
  for (const m of t.matchAll(RE_ITEM)) {
    const bruta = m[4].toUpperCase();
    const unidade = UNIDADES_ALIAS[bruta];
    const descricao = m[1].trim();
    if (!unidade) avisos.push(`${descricao}: unidade "${bruta}" desconhecida; tratada como unidade.`);
    itens.push({
      descricao,
      codigo: m[2],
      quantidade: parseBR(m[3]),
      unidade: unidade ?? "UNID",
      valorUnitarioCentavos: centavos(parseBR(m[5])),
      valorTotalCentavos: centavos(parseBR(m[6])),
    });
  }
  if (!itens.length) erros.push("Não encontrei nenhum item no texto.");

  // Cabeçalho e totais
  const num = (re: RegExp): string | null => {
    const m = t.match(re);
    return m ? m[1] : null;
  };
  const totalItens = num(/Qtd\.\s*total de itens:\s*(\d+)/i);
  const valorPagar = num(/Valor a pagar R\$:\s*([\d.,]+)/i);
  const pg = t.match(/Forma de pagamento:[^\n]*\n\s*([^\n]*?)\s*([\d.]+,\d{2})\s*(?:\n|$)/i);
  const numero = num(/N[úu]mero:\s*(\d+)/i);
  const serie = num(/S[ée]rie:\s*(\d+)/i);
  const dt = t.match(/Data de Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/i);
  const protocolo = num(/Protocolo de Autoriza[çc][ãa]o:\s*(\d+)/i);
  const kc = t.match(/Chave de acesso:\s*((?:\d{4}\s*){11})/i);

  const somaItensCentavos = itens.reduce((s, i) => s + i.valorTotalCentavos, 0);
  const cpfNaNota = /\bCPF\b/i.test(t) || /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/.test(t);

  const nota: NotaParseada = {
    loja,
    itens,
    numero: numero ? Number(numero) : null,
    serie: serie ? Number(serie) : null,
    emissao: dt ? `${dt[3]}-${dt[2]}-${dt[1]}T${dt[4]}` : null,
    protocolo,
    chave: kc ? onlyDigits(kc[1]) : null,
    totalItens: totalItens ? Number(totalItens) : null,
    valorPagarCentavos: valorPagar == null ? null : centavos(parseBR(valorPagar)),
    somaItensCentavos,
    pagamento: pg ? pg[1].trim() : null,
    cpfNaNota,
  };

  conferirNota(nota, avisos, erros);

  return { nota, avisos, erros };
}
