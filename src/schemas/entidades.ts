import { z } from "zod";
import {
  centavosNaoNegSchema,
  centavosSchema,
  chaveSchema,
  cnpjSchema,
  dataHoraSchema,
  dataSchema,
  idSchema,
  instanteSchema,
} from "./comum";
import {
  CATEGORIAS,
  FREQUENCIAS,
  NIVEIS,
  STATUS_ITEM_LISTA,
  STATUS_LISTA,
  TIPOS_IDA,
  TIPOS_MERCADO,
  TRANSPORTES,
  UNIDADES_NOTA,
  UNIDADES_PRODUTO,
} from "./constantes";

const nomeSchema = z.string().trim().min(1).max(200);

export const casaSchema = z.object({
  id: idSchema,
  nome: nomeSchema,
});

export const coordenadasSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const perfilSchema = z.object({
  id: idSchema,
  casaId: idSchema,
  localizacaoCasa: coordenadasSchema.optional(),
  arredondarLocalizacao: z.boolean().default(true),
  folgaDias: z.number().int().min(0).max(30).default(2),
  limiarAlertaPrecoPct: z.number().min(0).max(1000).default(20),
  /** Economia líquida mínima para propor dividir a lista. */
  economiaMinimaDivisaoCentavos: centavosNaoNegSchema.default(500),
  /** Janela, em dias, para "melhor mercado". */
  janelaPrecoDias: z.number().int().min(1).max(365).default(60),
  carro: z
    .object({
      consumoKmPorLitro: z.number().positive().default(10),
      precoCombustivelCentavos: centavosNaoNegSchema.default(600),
      desgasteCentavosPorKm: centavosNaoNegSchema.default(30),
    })
    .default({ consumoKmPorLitro: 10, precoCombustivelCentavos: 600, desgasteCentavosPorKm: 30 }),
  /** Custo da bike elétrica por km, em centavos (pode ser fracionário: 5 = R$ 0,05). */
  bikeCentavosPorKm: z.number().nonnegative().default(5),
  /** Quando foi feita (compartilhada ou baixada) a última cópia de segurança. Base do lembrete do Início. */
  ultimoBackupEm: instanteSchema.optional(),
});

export const agendaIdaSchema = z
  .object({
    id: idSchema,
    casaId: idSchema,
    tipo: z.enum(TIPOS_IDA),
    diaDoMes: z.number().int().min(1).max(31).optional(),
    /** 0 = domingo. */
    diaDaSemana: z.number().int().min(0).max(6).optional(),
    mercadoId: idSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "feira_mensal") {
      if (v.diaDoMes === undefined) ctx.addIssue({ code: "custom", path: ["diaDoMes"], message: "Informe o dia do mês" });
    } else if (v.diaDaSemana === undefined) {
      ctx.addIssue({ code: "custom", path: ["diaDaSemana"], message: "Informe o dia da semana" });
    }
  });

export const mercadoSchema = z.object({
  id: idSchema,
  casaId: idSchema,
  cnpj: cnpjSchema,
  nome: nomeSchema,
  apelido: z.string().trim().max(100).optional(),
  endereco: z.string().max(400).default(""),
  coordenadas: coordenadasSchema.optional(),
  tipo: z.enum(TIPOS_MERCADO).default("supermercado"),
  transporte: z.enum(TRANSPORTES).default("carro"),
  distanciaKm: z.number().nonnegative().optional(),
  tempoMinIda: z.number().nonnegative().optional(),
  custoFixoIdaCentavos: centavosNaoNegSchema.optional(),
});

export const produtoSchema = z.object({
  id: idSchema,
  casaId: idSchema,
  nome: nomeSchema,
  categoria: z.enum(CATEGORIAS).default("outros"),
  unidade: z.enum(UNIDADES_PRODUTO),
  meta: z.number().nonnegative(),
  /** Verdadeiro quando o usuário editou a meta (trava a atualização automática). */
  metaManual: z.boolean().default(false),
  /**
   * Item de uso contínuo: só os recorrentes entram sozinhos na lista da casa (padrão − atual).
   * Não recorrente = compra eventual, que apenas aparece na despensa. Registros antigos valem como recorrentes.
   */
  recorrente: z.boolean().default(true),
  frequencia: z.enum(FREQUENCIAS).default("semanal"),
  tipoIda: z.enum(TIPOS_IDA),
  vidaUtilDias: z.number().int().positive(),
  mercadoPreferidoId: idSchema.optional(),
  localCasa: z.string().trim().max(60).optional(),
  /** Produto "contável": aceita quantidade exata na conferência. */
  contavel: z.boolean().default(false),
  ativo: z.boolean().default(true),
});

export const apelidoMercadoSchema = z.object({
  casaId: idSchema,
  cnpj: cnpjSchema,
  codigo: z.string().min(1),
  produtoId: idSchema,
});

export const estoqueSchema = z.object({
  id: idSchema,
  casaId: idSchema,
  produtoId: idSchema,
  /** Quantidade atual (base do estoque). Pode passar do padrão (`Produto.meta`): compra a mais, promoção. */
  quantidade: z.number().nonnegative(),
  /** Rótulo do último atalho usado (cheio, metade, acabando, acabou); a verdade é `quantidade`. */
  nivel: z.enum(NIVEIS),
  quantidadeExata: z.number().nonnegative().optional(),
  confirmadoEm: instanteSchema,
  consumoDiarioEstimado: z.number().nonnegative().optional(),
});

export const itemCompraSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(1),
  produtoId: idSchema.optional(),
  quantidade: z.number().nonnegative(),
  unidade: z.enum(UNIDADES_NOTA),
  valorUnitarioCentavos: centavosSchema,
  valorTotalCentavos: centavosSchema,
});

/** Chave natural: `chave` (44 dígitos). Nunca guarda CPF nem o texto bruto. */
export const compraSchema = z.object({
  casaId: idSchema,
  chave: chaveSchema,
  mercadoId: idSchema,
  emissao: dataHoraSchema,
  valorTotalCentavos: centavosSchema,
  pagamento: z.string().max(100).default(""),
  itens: z.array(itemCompraSchema),
  custoIdaCentavos: centavosNaoNegSchema.optional(),
  listaId: idSchema.optional(),
  /** Quantos itens da nota já tinham apelido no catálogo na importação (métrica "itens casados"). */
  itensCasados: z.number().int().nonnegative().optional(),
  importadoEm: instanteSchema,
});

export const listaSchema = z.object({
  id: idSchema,
  casaId: idSchema,
  tipoIda: z.enum(TIPOS_IDA),
  data: dataSchema,
  status: z.enum(STATUS_LISTA).default("rascunho"),
  mercadoId: idSchema.optional(),
  orcamentoCentavos: centavosNaoNegSchema.optional(),
  estimativaCentavos: centavosNaoNegSchema.optional(),
  /** Total da nota que fechou a lista (para comparar com a estimativa). */
  gastoCentavos: centavosNaoNegSchema.optional(),
  criadaEm: instanteSchema,
});

export const itemListaSchema = z
  .object({
    id: idSchema,
    casaId: idSchema,
    listaId: idSchema,
    produtoId: idSchema.optional(),
    nomeAvulso: z.string().trim().min(1).max(200).optional(),
    quantidadeSugerida: z.number().nonnegative(),
    quantidadePega: z.number().nonnegative().optional(),
    status: z.enum(STATUS_ITEM_LISTA).default("pendente"),
    /** Preço unitário informado no mercado (por kg, unidade, litro ou pacote). */
    precoCentavos: centavosNaoNegSchema.optional(),
    motivo: z.enum(["acabou", "cobertura", "puxado", "abaixo", "manual"]).optional(),
    urgente: z.boolean().default(false),
    /** Edições manuais preservadas ao regerar a lista. */
    removido: z.boolean().default(false),
    quantidadeEditada: z.boolean().default(false),
  })
  .refine((v) => v.produtoId !== undefined || v.nomeAvulso !== undefined, {
    message: "Item precisa de produto ou nome avulso",
  });

/** Registro de uma sessão de conferência da despensa (alimenta o painel: tempo médio de conferência). */
export const conferenciaSchema = z.object({
  id: idSchema,
  casaId: idSchema,
  /** Só nas conferências feitas por ida (antes de 06/11/2026); a revisão da despensa não tem ida. */
  tipoIda: z.enum(TIPOS_IDA).optional(),
  iniciadaEm: instanteSchema,
  duracaoSegundos: z.number().int().nonnegative(),
  produtosConferidos: z.number().int().nonnegative(),
  /** Produtos marcados como "acabou" nesta conferência que ainda não estavam como acabou (ruptura). */
  rupturas: z.number().int().nonnegative().default(0),
});
