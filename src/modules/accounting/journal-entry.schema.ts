import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { JOURNAL_ENTRY_STATUSES } from './journal-entry.model'

export const journalEntryLineSchema = z.object({
  account_id:  z.string().uuid(),
  branch_id:   z.string().uuid().nullable().optional(),
  description: z.string().max(255).nullable().optional(),
  debit:       z.coerce.number().min(0).default(0),
  credit:      z.coerce.number().min(0).default(0),
  sort_order:  z.coerce.number().int().min(0).default(0),
}).refine(
  line => !(line.debit > 0 && line.credit > 0),
  { message: 'Una línea no puede tener débito y crédito a la vez', path: ['debit'] },
).refine(
  line => line.debit > 0 || line.credit > 0,
  { message: 'La línea debe tener un importe en débito o crédito', path: ['debit'] },
)

export const journalEntrySchema = z.object({
  entry_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  description: z.string().max(2000).nullable().optional(),
  lines:       z.array(journalEntryLineSchema).min(2, 'El asiento requiere al menos dos líneas'),
})

export const journalEntryUpdateSchema = z.object({
  entry_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)').optional(),
  description: z.string().max(2000).nullable().optional(),
  lines:       z.array(journalEntryLineSchema).min(2, 'El asiento requiere al menos dos líneas').optional(),
})

export const journalEntryQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  status:    z.enum(JOURNAL_ENTRY_STATUSES).optional(),
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  branch_id: z.string().uuid().optional(),
})

export const trialBalanceQuerySchema = z.object({
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  branch_id: z.string().uuid().optional(),
})

export const incomeStatementQuerySchema = trialBalanceQuerySchema

export type JournalEntryLineInput = z.infer<typeof journalEntryLineSchema>
export type JournalEntryInput      = z.infer<typeof journalEntrySchema>
export type JournalEntryUpdateInput = z.infer<typeof journalEntryUpdateSchema>
export type JournalEntryQuery      = z.infer<typeof journalEntryQuerySchema>
export type TrialBalanceQuery      = z.infer<typeof trialBalanceQuerySchema>
export type IncomeStatementQuery   = z.infer<typeof incomeStatementQuerySchema>
