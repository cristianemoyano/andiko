import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const supplierPaymentSchema = z.object({
  branch_id:      z.string().uuid(),
  invoice_id:     z.string().uuid(),
  contact_id:     z.string().uuid().nullable().optional(),
  payment_date:   z.string().datetime({ offset: true }).transform(s => new Date(s)),
  amount:         z.coerce.number().positive(),
  payment_method: z.string().min(1).max(50).default('transfer'),
  notes:          z.string().nullable().optional(),
})

export const supplierPaymentUpdateSchema = supplierPaymentSchema.omit({ invoice_id: true }).partial()

export const supplierPaymentQuerySchema = paginationSchema.extend({
  invoice_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
})

export type SupplierPaymentInput       = z.infer<typeof supplierPaymentSchema>
export type SupplierPaymentUpdateInput = z.infer<typeof supplierPaymentUpdateSchema>
export type SupplierPaymentQuery       = z.infer<typeof supplierPaymentQuerySchema>
