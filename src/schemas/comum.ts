import { z } from "zod";

export const idSchema = z.uuid();
export const centavosSchema = z.number().int();
export const centavosNaoNegSchema = z.number().int().nonnegative();
/** Data sem hora: YYYY-MM-DD. */
export const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD");
/** Data e hora local, sem fuso: YYYY-MM-DDTHH:mm:ss. */
export const dataHoraSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, "Data/hora deve estar no formato AAAA-MM-DDTHH:mm:ss");
/** Instante (importação, confirmação): ISO 8601 com fuso. */
export const instanteSchema = z.iso.datetime({ offset: true });
export const cnpjSchema = z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos");
export const chaveSchema = z.string().regex(/^\d{44}$/, "Chave deve ter 44 dígitos");
