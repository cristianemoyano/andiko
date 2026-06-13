import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { ACCOUNT_TYPES, type AccountType } from './default-chart'

const accountTypeEnum = z.enum([...ACCOUNT_TYPES] as [AccountType, ...AccountType[]])

export const accountSchema = z.object({
  code:        z.string().trim().min(1).max(20),
  name:        z.string().trim().min(1).max(120),
  type:        accountTypeEnum,
  parent_id:   z.string().uuid().nullable().optional(),
  is_postable: z.boolean().default(true),
  is_active:   z.boolean().default(true),
})

export const accountUpdateSchema = accountSchema.partial()

export const accountQuerySchema = paginationSchema.extend({
  search:      z.string().optional(),
  type:        accountTypeEnum.optional(),
  is_postable: z.coerce.boolean().optional(),
  is_active:   z.coerce.boolean().optional(),
  /** When true, return the full chart (no pagination) for tree rendering. */
  all:         z.coerce.boolean().optional(),
})

export type AccountInput       = z.infer<typeof accountSchema>
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>
export type AccountQuery       = z.infer<typeof accountQuerySchema>
