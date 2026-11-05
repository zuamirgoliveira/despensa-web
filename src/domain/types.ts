import type { z } from "zod";
import type {
  agendaIdaSchema,
  apelidoMercadoSchema,
  casaSchema,
  compraSchema,
  conferenciaSchema,
  coordenadasSchema,
  estoqueSchema,
  itemCompraSchema,
  itemListaSchema,
  listaSchema,
  mercadoSchema,
  perfilSchema,
  produtoSchema,
} from "@/schemas";

export type Casa = z.infer<typeof casaSchema>;
export type Coordenadas = z.infer<typeof coordenadasSchema>;
export type Perfil = z.infer<typeof perfilSchema>;
export type AgendaIda = z.infer<typeof agendaIdaSchema>;
export type Mercado = z.infer<typeof mercadoSchema>;
export type Produto = z.infer<typeof produtoSchema>;
export type ApelidoMercado = z.infer<typeof apelidoMercadoSchema>;
export type Estoque = z.infer<typeof estoqueSchema>;
export type ItemCompra = z.infer<typeof itemCompraSchema>;
export type Compra = z.infer<typeof compraSchema>;
export type Lista = z.infer<typeof listaSchema>;
export type RegistroConferencia = z.infer<typeof conferenciaSchema>;
export type ItemLista = z.infer<typeof itemListaSchema>;

export type Categoria = Produto["categoria"];
export type Nivel = Estoque["nivel"];
export type TipoIda = AgendaIda["tipo"];
