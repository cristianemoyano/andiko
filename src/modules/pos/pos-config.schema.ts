import { z } from 'zod'
import type { BalanzaBarcodeConfig } from './balanza-barcode'

export const balanzaConfigSchema = z.object({
  enabled:            z.boolean(),
  prefix:             z.string().regex(/^\d{1,3}$/, 'El prefijo debe tener 1 a 3 dígitos'),
  totalLength:        z.number().int().min(8).max(14),
  itemCodeStart:      z.number().int().min(0).max(13),
  itemCodeLength:     z.number().int().min(1).max(13),
  valueStart:         z.number().int().min(0).max(13),
  valueLength:        z.number().int().min(1).max(13),
  valueType:          z.enum(['price', 'weight']),
  valueDivisor:       z.number().int().min(1).max(100000),
  validateCheckDigit: z.boolean(),
}).superRefine((cfg, ctx) => {
  if (cfg.itemCodeStart + cfg.itemCodeLength > cfg.totalLength) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['itemCodeLength'], message: 'El código de ítem excede el largo total' })
  }
  if (cfg.valueStart + cfg.valueLength > cfg.totalLength) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valueLength'], message: 'El valor excede el largo total' })
  }
}) satisfies z.ZodType<BalanzaBarcodeConfig>

/** Per-organization POS configuration stored in organization_settings.pos_config (JSONB). */
export type PosTicketFiscalConfig = {
  /** Ingresos brutos (número de inscripción) */
  gross_income?: string | null
  /** Inicio de actividades — ISO date `yyyy-mm-dd` */
  activity_start_date?: string | null
  /** Leyenda defensa del consumidor (ej. teléfono provincial) */
  consumer_defense_line?: string | null
  /** Código AFIP del comprobante en ticket (ej. 083 = Tique) */
  comprobante_codigo?: string | null
}

export type PosConfig = {
  balanza?: BalanzaBarcodeConfig
  ticket?: PosTicketFiscalConfig
}

export const posTicketFiscalSchema = z.object({
  gross_income: z.string().max(32).nullable().optional(),
  activity_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  consumer_defense_line: z.string().max(120).nullable().optional(),
  comprobante_codigo: z.string().max(8).nullable().optional(),
}).optional()

export const posConfigSchema = z.object({
  balanza: balanzaConfigSchema.optional(),
  ticket: posTicketFiscalSchema,
})
