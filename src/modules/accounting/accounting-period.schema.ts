import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const closePeriodSchema = z.object({
  from:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  to:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  notes: z.string().max(2000).nullable().optional(),
}).refine(input => input.from <= input.to, {
  message: 'La fecha desde no puede ser posterior a la fecha hasta',
  path: ['from'],
})

export const accountingPeriodQuerySchema = paginationSchema

export type ClosePeriodInput = z.infer<typeof closePeriodSchema>
export type AccountingPeriodQuery = z.infer<typeof accountingPeriodQuerySchema>
