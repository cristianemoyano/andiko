import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { FULFILLMENT_KINDS } from './logistics.constants'

export const carrierAccountSchema = z.object({
  kind:       z.enum(FULFILLMENT_KINDS),
  name:       z.string().min(1).max(120),
  branch_id:  z.string().uuid().nullable().optional(),
  is_active:  z.boolean().default(true),
  /** Credenciales de API (phase 2). Se guardan cifradas, nunca en texto plano. */
  credentials: z.record(z.string(), z.string()).nullable().optional(),
  settings:   z.record(z.string(), z.unknown()).default({}),
})

export const carrierAccountUpdateSchema = carrierAccountSchema.partial()

export const carrierAccountQuerySchema = paginationSchema.extend({
  kind:      z.enum(FULFILLMENT_KINDS).optional(),
  branch_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
  search:    z.string().optional(),
})

export type CarrierAccountInput       = z.infer<typeof carrierAccountSchema>
export type CarrierAccountUpdateInput = z.infer<typeof carrierAccountUpdateSchema>
export type CarrierAccountQuery      = z.infer<typeof carrierAccountQuerySchema>
