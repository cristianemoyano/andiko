import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { SCHEDULED_TASK_STATUSES } from './scheduled-task.model'

export const scheduledTaskSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  action_type: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).default({}),
  cron_expression: z.string().min(1).max(64),
  timezone: z.string().min(1).max(64).default('America/Argentina/Buenos_Aires'),
  max_consecutive_failures: z.coerce.number().int().min(1).max(50).default(5),
})

export const scheduledTaskUpdateSchema = scheduledTaskSchema.partial().extend({
  status: z.enum(SCHEDULED_TASK_STATUSES).optional(),
})

export const scheduledTaskQuerySchema = paginationSchema.extend({
  status: z.enum(SCHEDULED_TASK_STATUSES).optional(),
})

export const scheduledTaskRunQuerySchema = paginationSchema

export type ScheduledTaskInput = z.infer<typeof scheduledTaskSchema>
export type ScheduledTaskUpdateInput = z.infer<typeof scheduledTaskUpdateSchema>
export type ScheduledTaskQuery = z.infer<typeof scheduledTaskQuerySchema>
