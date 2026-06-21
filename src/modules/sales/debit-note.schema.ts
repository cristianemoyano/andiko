import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { DEBIT_NOTE_STATUSES } from './debit-note.model'

export const debitNoteQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: z.enum(DEBIT_NOTE_STATUSES).optional(),
  contact_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
})
export type DebitNoteQuery = z.infer<typeof debitNoteQuerySchema>

export const createDebitNoteSchema = z.object({
  invoice_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  issue_date: z.coerce.date().optional(),
  currency: z.string().length(3).default('ARS'),
  subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/),
  discount_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  tax_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  total: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})
export type CreateDebitNoteInput = z.infer<typeof createDebitNoteSchema>

export const updateDebitNoteSchema = createDebitNoteSchema.partial()
export type UpdateDebitNoteInput = z.infer<typeof updateDebitNoteSchema>
