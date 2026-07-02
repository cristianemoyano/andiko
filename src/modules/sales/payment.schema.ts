import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { PAYMENT_METHODS, type PaymentMethod } from './payment.constants'

const paymentMethodEnum = z.enum([...PAYMENT_METHODS] as [PaymentMethod, ...PaymentMethod[]])

export const paymentSchema = z.object({
  invoice_id:     z.string().uuid(),
  branch_id:      z.string().uuid().nullable().optional(),
  contact_id:     z.string().uuid().nullable().optional(),
  payment_date:   z.string().datetime({ offset: true }).transform(s => new Date(s)).optional(),
  amount:         z.coerce.number().positive(),
  payment_method: paymentMethodEnum,
  reference:      z.string().max(255).nullable().optional(),
  notes:          z.string().nullable().optional(),
})

export const paymentUpdateSchema = paymentSchema.omit({ invoice_id: true }).partial()

export const paymentQuerySchema = paginationSchema.extend({
  invoice_id:     z.string().uuid().optional(),
  contact_id:     z.string().uuid().optional(),
  payment_method: paymentMethodEnum.optional(),
})

export type PaymentInput       = z.infer<typeof paymentSchema>
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>
export type PaymentQuery       = z.infer<typeof paymentQuerySchema>
