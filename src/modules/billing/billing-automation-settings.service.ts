import 'server-only'
import PlatformSetting from '@/modules/auth/platform-setting.model'
import { computeNextRunAt, validateCronExpression } from '@/modules/automations/cron'
import { DEFAULT_CRON_TIMEZONE } from '@/lib/cron-presets'
import { getBillingDuePreview } from './billing-generate-due.service'
import type {
  BillingAutomationPublic,
  BillingAutomationUpdateInput,
} from './billing-automation-settings.schema'

const DEFAULT_BILLING_CRON = '0 5 * * *'

async function getRow(): Promise<PlatformSetting> {
  const existing = await PlatformSetting.findOne({ where: { singleton: true } })
  if (existing) return existing
  return PlatformSetting.create({ singleton: true })
}

async function toPublic(row: PlatformSetting): Promise<BillingAutomationPublic> {
  const due_preview = await getBillingDuePreview()
  return {
    enabled: row.billing_invoice_automation_enabled,
    cron_expression: row.billing_invoice_automation_cron || DEFAULT_BILLING_CRON,
    timezone: row.billing_invoice_automation_timezone || DEFAULT_CRON_TIMEZONE,
    last_run_at: row.billing_invoice_automation_last_run_at?.toISOString() ?? null,
    last_run_status: row.billing_invoice_automation_last_run_status,
    last_run_summary: row.billing_invoice_automation_last_run_summary,
    next_run_at: row.billing_invoice_automation_next_run_at?.toISOString() ?? null,
    due_preview,
  }
}

export async function getBillingAutomationSettings(): Promise<BillingAutomationPublic> {
  return toPublic(await getRow())
}

export async function updateBillingAutomationSettings(
  input: BillingAutomationUpdateInput,
): Promise<BillingAutomationPublic> {
  const row = await getRow()
  const cron = input.cron_expression?.trim() ?? row.billing_invoice_automation_cron
  const timezone = input.timezone?.trim() || row.billing_invoice_automation_timezone || DEFAULT_CRON_TIMEZONE

  const validation = validateCronExpression(cron)
  if (!validation.valid) {
    throw new Error(`INVALID_CRON:${validation.error}`)
  }

  const enabled = input.enabled ?? row.billing_invoice_automation_enabled
  let nextRunAt = row.billing_invoice_automation_next_run_at
  if (enabled) {
    nextRunAt = computeNextRunAt(cron, timezone)
  }

  await row.update({
    billing_invoice_automation_enabled: enabled,
    billing_invoice_automation_cron: cron || DEFAULT_BILLING_CRON,
    billing_invoice_automation_timezone: timezone || DEFAULT_CRON_TIMEZONE,
    billing_invoice_automation_next_run_at: enabled ? nextRunAt : row.billing_invoice_automation_next_run_at,
  })

  return toPublic(await getRow())
}

export type BillingAutomationRunStatus = 'success' | 'failed' | 'skipped'

export async function recordBillingAutomationRun(input: {
  status: BillingAutomationRunStatus
  summary: Record<string, unknown>
  cron: string
  timezone: string
  enabled: boolean
}): Promise<BillingAutomationPublic> {
  const row = await getRow()
  const nextRunAt = input.enabled
    ? computeNextRunAt(input.cron, input.timezone)
    : row.billing_invoice_automation_next_run_at

  await row.update({
    billing_invoice_automation_last_run_at: new Date(),
    billing_invoice_automation_last_run_status: input.status,
    billing_invoice_automation_last_run_summary: input.summary,
    billing_invoice_automation_next_run_at: nextRunAt,
  })

  return toPublic(await getRow())
}

/**
 * Atomically claims a due automation tick by advancing next_run_at.
 * Returns claim metadata when claimed, or null when not due / disabled.
 */
export async function claimDueBillingAutomationTick(
  now: Date = new Date(),
): Promise<{ cron_expression: string; timezone: string } | null> {
  const row = await getRow()
  if (!row.billing_invoice_automation_enabled) return null

  const cron = row.billing_invoice_automation_cron || DEFAULT_BILLING_CRON
  const timezone = row.billing_invoice_automation_timezone || DEFAULT_CRON_TIMEZONE
  const nextRunAt = row.billing_invoice_automation_next_run_at

  if (nextRunAt && nextRunAt.getTime() > now.getTime()) return null

  // If never scheduled, seed next_run_at and skip this tick (avoid surprise first fire).
  if (!nextRunAt) {
    await row.update({
      billing_invoice_automation_next_run_at: computeNextRunAt(cron, timezone, now),
    })
    return null
  }

  const claimedNext = computeNextRunAt(cron, timezone, now)
  const [affected] = await PlatformSetting.update(
    { billing_invoice_automation_next_run_at: claimedNext },
    {
      where: {
        singleton: true,
        billing_invoice_automation_enabled: true,
        billing_invoice_automation_next_run_at: nextRunAt,
      },
    },
  )
  if (affected === 0) return null

  return { cron_expression: cron, timezone }
}

export { DEFAULT_BILLING_CRON }
