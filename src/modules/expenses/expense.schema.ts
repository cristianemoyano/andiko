import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { IVA_RATES, type IvaRate } from '@/types'
import { EXPENSE_STATUSES } from './expense.model'

const ivaRateEnum = z.enum([...IVA_RATES] as [IvaRate, ...IvaRate[]])

export const expenseSchema = z.object({
  branch_id:             z.string().uuid(),
  contact_id:            z.string().uuid(),
  description:           z.string().min(1).max(500),
  expense_account_code:  z.string().min(1).max(20),
  invoice_number:        z.string().max(50).nullable().optional(),
  invoice_date:          z.string().datetime({ offset: true }).transform(s => new Date(s)),
  due_date:              z.string().datetime({ offset: true }).transform(s => new Date(s)),
  currency:              z.string().length(3).default('ARS'),
  subtotal:              z.coerce.number().min(0),
  discount_amount:       z.coerce.number().min(0).default(0),
  iva_rate:              ivaRateEnum.default('21'),
  notes:                 z.string().nullable().optional(),
})

export const expenseUpdateSchema = expenseSchema.partial()

export const expenseQuerySchema = paginationSchema.extend({
  search:     z.string().optional(),
  status:     z.enum(EXPENSE_STATUSES).optional(),
  contact_id: z.string().uuid().optional(),
  overdue:    z.coerce.boolean().optional(),
})

export type ExpenseInput       = z.infer<typeof expenseSchema>
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>
export type ExpenseQuery       = z.infer<typeof expenseQuerySchema>
