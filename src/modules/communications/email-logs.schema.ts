import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { EMAIL_DOCUMENT_TYPES } from './email-template.schema'

export const emailLogStatusSchema = z.enum(['sent', 'failed'])

export const emailLogListQuerySchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  status: emailLogStatusSchema.optional(),
  document_type: z.enum(EMAIL_DOCUMENT_TYPES).optional(),
})

export type EmailLogListQuery = z.infer<typeof emailLogListQuerySchema>
