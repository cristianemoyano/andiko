import { z } from 'zod'

export const billingAutomationUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  cron_expression: z.string().min(1).max(64).optional(),
  timezone: z.string().min(1).max(64).optional(),
})

export type BillingAutomationUpdateInput = z.infer<typeof billingAutomationUpdateSchema>

export interface BillingAutomationPublic {
  enabled: boolean
  cron_expression: string
  timezone: string
  last_run_at: string | null
  last_run_status: 'success' | 'failed' | 'skipped' | null
  last_run_summary: Record<string, unknown> | null
  next_run_at: string | null
  /** Live preview of due candidates (not persisted). */
  due_preview: {
    active_subscriptions: number
    due_subscriptions: number
    next_period_end: string | null
  }
}
