import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { BILLING_INVOICE_STATUSES } from '@/types'

export const generateInvoiceSchema = z.object({
  subscription_id: z.string().uuid(),
  period_start:    z.coerce.date().optional(),
  period_end:      z.coerce.date().optional(),
  due_date:        z.coerce.date().nullable().optional(),
  notes:           z.string().max(2000).nullable().optional(),
}).refine(
  d => !d.period_start || !d.period_end || d.period_end >= d.period_start,
  { message: 'period_end debe ser posterior o igual a period_start', path: ['period_end'] },
)

export const billingInvoiceQuerySchema = paginationSchema.extend({
  org_id:          z.string().uuid().optional(),
  subscription_id: z.string().uuid().optional(),
  status:          z.enum(BILLING_INVOICE_STATUSES).optional(),
  overdue:         z.coerce.boolean().optional(),
})

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>
export type BillingInvoiceQuery = z.infer<typeof billingInvoiceQuerySchema>
