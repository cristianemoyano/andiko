import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { isTrackedBillingMetricKey } from './billing-metrics.catalog'

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (máx. 2 decimales)')

const billingMetricFieldsSchema = z.object({
  key:        z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Sólo minúsculas, números y guión bajo'),
  label:      z.string().min(1).max(255),
  unit_label: z.string().max(50).nullable().optional(),
  unit_price: moneyString.default('0.00'),
  is_active:  z.boolean().default(true),
})

export const billingMetricSchema = billingMetricFieldsSchema.superRefine((data, ctx) => {
  if (!isTrackedBillingMetricKey(data.key)) {
    ctx.addIssue({
      code: 'custom',
      message: 'La clave no corresponde a una métrica registrada en el sistema',
      path: ['key'],
    })
  }
})

/** PATCH — key and unit_price are immutable; pricing lives on billing plans. */
export const billingMetricUpdateSchema = billingMetricFieldsSchema
  .omit({ key: true, unit_price: true })
  .partial()

export const billingMetricQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  is_active: z.coerce.boolean().optional(),
})

export type BillingMetricInput = z.infer<typeof billingMetricSchema>
export type BillingMetricUpdateInput = z.infer<typeof billingMetricUpdateSchema>
export type BillingMetricQuery = z.infer<typeof billingMetricQuerySchema>
