// Validação do formulário de produto: converte o texto digitado (vírgula decimal) e aplica o schema.
import type { Produto } from "@/domain/types";
import { produtoSchema } from "@/schemas";

export type ValoresProduto = {
  nome: string;
  categoria: string;
  unidade: string;
  meta: string;
  frequencia: string;
  tipoIda: string;
  vidaUtilDias: string;
  localCasa: string;
  mercadoPreferidoId: string;
  contavel: boolean;
};

export type CampoProduto = keyof ValoresProduto;
export type ResultadoForm = { ok: true; produto: Produto } | { ok: false; erros: Partial<Record<CampoProduto, string>> };

const MENSAGENS: Record<CampoProduto, string> = {
  nome: "Informe o nome do produto.",
  categoria: "Escolha uma categoria.",
  unidade: "Escolha a unidade.",
  meta: "Informe um número maior ou igual a zero.",
  frequencia: "Escolha a frequência.",
  tipoIda: "Escolha o tipo de ida.",
  vidaUtilDias: "Informe a vida útil em dias (número inteiro maior que zero).",
  localCasa: "Texto longo demais.",
  mercadoPreferidoId: "Mercado inválido.",
  contavel: "Valor inválido.",
};

export function valoresDoProduto(p: Produto): ValoresProduto {
  return {
    nome: p.nome,
    categoria: p.categoria,
    unidade: p.unidade,
    meta: String(p.meta).replace(".", ","),
    frequencia: p.frequencia,
    tipoIda: p.tipoIda,
    vidaUtilDias: String(p.vidaUtilDias),
    localCasa: p.localCasa ?? "",
    mercadoPreferidoId: p.mercadoPreferidoId ?? "",
    contavel: p.contavel,
  };
}

const numero = (s: string): number => (s.trim() === "" ? Number.NaN : Number(s.trim().replace(/\./g, "").replace(",", ".")));

export function validarProduto(original: Produto, v: ValoresProduto): ResultadoForm {
  const candidato = {
    ...original,
    nome: v.nome,
    categoria: v.categoria,
    unidade: v.unidade,
    meta: numero(v.meta),
    frequencia: v.frequencia,
    tipoIda: v.tipoIda,
    vidaUtilDias: numero(v.vidaUtilDias),
    localCasa: v.localCasa.trim() || undefined,
    mercadoPreferidoId: v.mercadoPreferidoId || undefined,
    contavel: v.contavel,
  };
  const r = produtoSchema.safeParse(candidato);
  if (r.success) return { ok: true, produto: r.data };
  const erros: Partial<Record<CampoProduto, string>> = {};
  for (const issue of r.error.issues) {
    const campo = issue.path[0] as CampoProduto;
    if (campo in MENSAGENS && !erros[campo]) erros[campo] = MENSAGENS[campo];
  }
  return { ok: false, erros };
}
