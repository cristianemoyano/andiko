import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (máx. 2 decimales)')

export const billingMetricSchema = z.object({
  key:        z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Sólo minúsculas, números y guión bajo'),
  label:      z.string().min(1).max(255),
  unit_label: z.string().max(50).nullable().optional(),
  unit_price: moneyString.default('0.00'),
  is_active:  z.boolean().default(true),
})

export const billingMetricUpdateSchema = billingMetricSchema.partial()

export const billingMetricQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  is_active: z.coerce.boolean().optional(),
})

export type BillingMetricInput = z.infer<typeof billingMetricSchema>
export type BillingMetricUpdateInput = z.infer<typeof billingMetricUpdateSchema>
export type BillingMetricQuery = z.infer<typeof billingMetricQuerySchema>
