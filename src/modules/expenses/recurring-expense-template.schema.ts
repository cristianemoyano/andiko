import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { IVA_RATES, type IvaRate } from '@/types'
import { RECURRING_EXPENSE_FREQUENCIES } from './recurring-expense-template.model'

const ivaRateEnum = z.enum([...IVA_RATES] as [IvaRate, ...IvaRate[]])
const frequencyEnum = z.enum(RECURRING_EXPENSE_FREQUENCIES)

export const recurringExpenseTemplateSchema = z.object({
  branch_id:             z.string().uuid(),
  contact_id:            z.string().uuid(),
  description:           z.string().min(1).max(500),
  expense_account_code:  z.string().min(1).max(20),
  default_amount:        z.coerce.number().positive(),
  iva_rate:              ivaRateEnum.default('21'),
  frequency:             frequencyEnum.default('monthly'),
  next_run_date:         z.string().datetime({ offset: true }).transform(s => new Date(s)),
  is_active:             z.boolean().default(true),
})

export const recurringExpenseTemplateUpdateSchema = recurringExpenseTemplateSchema.partial()

export const recurringExpenseTemplateQuerySchema = paginationSchema.extend({
  contact_id: z.string().uuid().optional(),
  is_active:  z.coerce.boolean().optional(),
})

export type RecurringExpenseTemplateInput       = z.infer<typeof recurringExpenseTemplateSchema>
export type RecurringExpenseTemplateUpdateInput = z.infer<typeof recurringExpenseTemplateUpdateSchema>
export type RecurringExpenseTemplateQuery       = z.infer<typeof recurringExpenseTemplateQuerySchema>
