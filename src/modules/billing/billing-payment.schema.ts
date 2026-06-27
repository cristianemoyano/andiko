import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { BILLING_PAYMENT_METHODS } from '@/types'

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (máx. 2 decimales)')

export const billingPaymentSchema = z.object({
  invoice_id:     z.string().uuid(),
  payment_date:   z.coerce.date().optional(),
  amount:         moneyString,
  payment_method: z.enum(BILLING_PAYMENT_METHODS),
  reference:      z.string().max(255).nullable().optional(),
  notes:          z.string().max(2000).nullable().optional(),
})

export const billingPaymentQuerySchema = paginationSchema.extend({
  org_id:     z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
})

export type BillingPaymentInput = z.infer<typeof billingPaymentSchema>
export type BillingPaymentQuery = z.infer<typeof billingPaymentQuerySchema>
