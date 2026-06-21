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
export type PosConfig = {
  balanza?: BalanzaBarcodeConfig
}

export const posConfigSchema = z.object({
  balanza: balanzaConfigSchema.optional(),
})
