import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { IVA_RATES, type IvaRate } from '@/types'
import { EXPENSE_SCHEDULE_FREQUENCIES } from './expense-schedule.model'
import { expenseLineItemSchema } from './expense.schema'

const ivaRateEnum = z.enum([...IVA_RATES] as [IvaRate, ...IvaRate[]])
const frequencyEnum = z.enum(EXPENSE_SCHEDULE_FREQUENCIES)

export const expenseScheduleSchema = z.object({
  branch_id:             z.string().uuid(),
  contact_id:            z.string().uuid(),
  description:           z.string().min(1).max(500),
  expense_account_code:  z.string().min(1).max(20),
  default_amount:        z.coerce.number().positive(),
  iva_rate:              ivaRateEnum.default('21'),
  frequency:             frequencyEnum.default('monthly'),
  next_run_date:         z.string().datetime({ offset: true }).transform(s => new Date(s)),
  is_active:             z.boolean().default(true),
  items:                 z.array(expenseLineItemSchema).min(1).optional(),
})

export const expenseScheduleUpdateSchema = expenseScheduleSchema.partial()

export const expenseScheduleQuerySchema = paginationSchema.extend({
  contact_id: z.string().uuid().optional(),
  is_active:  z.coerce.boolean().optional(),
})

export type ExpenseScheduleInput       = z.infer<typeof expenseScheduleSchema>
export type ExpenseScheduleUpdateInput = z.infer<typeof expenseScheduleUpdateSchema>
export type ExpenseScheduleQuery       = z.infer<typeof expenseScheduleQuerySchema>

/** @deprecated Aliases — prefer expenseSchedule* */
export const recurringExpenseTemplateSchema = expenseScheduleSchema
export const recurringExpenseTemplateUpdateSchema = expenseScheduleUpdateSchema
export const recurringExpenseTemplateQuerySchema = expenseScheduleQuerySchema
export type RecurringExpenseTemplateInput = ExpenseScheduleInput
export type RecurringExpenseTemplateUpdateInput = ExpenseScheduleUpdateInput
export type RecurringExpenseTemplateQuery = ExpenseScheduleQuery
