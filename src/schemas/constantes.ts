export const CATEGORIAS = [
  "hortifruti",
  "mercearia",
  "limpeza",
  "higiene",
  "carnes",
  "laticinios",
  "bebidas",
  "outros",
] as const;

/** Vida útil padrão por categoria, em dias. */
export const VIDA_UTIL_PADRAO_DIAS: Record<(typeof CATEGORIAS)[number], number> = {
  hortifruti: 7,
  laticinios: 10,
  carnes: 3,
  mercearia: 180,
  limpeza: 365,
  higiene: 365,
  bebidas: 90,
  outros: 90,
};

export const NIVEIS = ["cheio", "metade", "acabando", "acabou"] as const;
export const TIPOS_IDA = ["feira_mensal", "mercado_semanal", "hortifruti_semanal"] as const;
export const UNIDADES_PRODUTO = ["kg", "un", "pacote", "l"] as const;
export const FREQUENCIAS = ["semanal", "quinzenal", "mensal", "sob_demanda"] as const;
export const TIPOS_MERCADO = ["hortifruti", "supermercado", "atacarejo", "padaria", "acougue", "lanchonete", "farmacia", "conveniencia", "feira", "outro"] as const;
export const TRANSPORTES = ["carro", "bike_eletrica", "a_pe"] as const;
export const UNIDADES_NOTA = ["KG", "UNID", "L", "PCT"] as const;
export const STATUS_LISTA = ["rascunho", "em_compra", "fechada"] as const;
export const STATUS_ITEM_LISTA = ["pendente", "pego", "nao_encontrado", "adiado", "extra"] as const;

/** Perecível: vida útil de até 14 dias (nunca vai para a feira mensal). */
export const LIMITE_PERECIVEL_DIAS = 14;

export const CASA_PADRAO_NOME = "Minha casa";
