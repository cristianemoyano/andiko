import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const expensePaymentSchema = z.object({
  branch_id:        z.string().uuid().optional(),
  expense_id:       z.string().uuid(),
  contact_id:       z.string().uuid().nullable().optional(),
  payment_date:     z.string().datetime({ offset: true }).transform(s => new Date(s)),
  amount:           z.coerce.number().positive(),
  payment_method:   z.string().min(1).max(50).default('transfer'),
  notes:            z.string().nullable().optional(),
  /** Required when the expense is an installment plan — cuotas being paid. */
  installment_ids:  z.array(z.string().uuid()).min(1).optional(),
})

export const expensePaymentUpdateSchema = expensePaymentSchema
  .omit({ expense_id: true, installment_ids: true })
  .partial()

export const expensePaymentQuerySchema = paginationSchema.extend({
  expense_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
})

export type ExpensePaymentInput       = z.infer<typeof expensePaymentSchema>
export type ExpensePaymentUpdateInput = z.infer<typeof expensePaymentUpdateSchema>
export type ExpensePaymentQuery       = z.infer<typeof expensePaymentQuerySchema>
