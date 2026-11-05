// Rótulos em português para os valores de enum mostrados na interface.
import type { Categoria, TipoIda } from "@/domain/types";
import type { Produto } from "@/domain/types";

export const CATEGORIA_ROTULO: Record<Categoria, string> = {
  hortifruti: "Hortifruti",
  mercearia: "Mercearia",
  limpeza: "Limpeza",
  higiene: "Higiene",
  carnes: "Carnes",
  laticinios: "Laticínios",
  bebidas: "Bebidas",
  outros: "Outros",
};

export const UNIDADE_ROTULO: Record<Produto["unidade"], string> = { kg: "kg", un: "unidade", pacote: "pacote", l: "litro" };

export const FREQUENCIA_ROTULO: Record<Produto["frequencia"], string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  sob_demanda: "Sob demanda",
};

export const TIPO_IDA_ROTULO: Record<TipoIda, string> = {
  feira_mensal: "Feira mensal",
  mercado_semanal: "Mercado semanal",
  hortifruti_semanal: "Hortifruti semanal",
};
