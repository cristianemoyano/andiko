import { z } from 'zod'
import { AFIP_ENVIRONMENTS } from './afip-codes'

export const libroIvaQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((v) => v.from <= v.to, { message: 'from must be on or before to', path: ['from'] })
export type LibroIvaQuery = z.infer<typeof libroIvaQuerySchema>

export const afipConfigSchema = z.object({
  branch_id: z.string().uuid(),
  punto_venta: z.number().int().positive().max(99999),
})
export type AfipConfigInput = z.infer<typeof afipConfigSchema>

export const afipEnvironmentSchema = z.object({
  environment: z.enum(AFIP_ENVIRONMENTS),
})
