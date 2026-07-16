import { NextResponse } from 'next/server'
import { env } from '@/config/env'
import {
  claimDueBillingAutomationTick,
  getBillingAutomationSettings,
  recordBillingAutomationRun,
} from '@/modules/billing/billing-automation-settings.service'
import { generateDueBillingInvoices } from '@/modules/billing/billing-generate-due.service'

/**
 * Billing invoice automation tick: when enabled and the cron is due, generates
 * draft invoices for subscriptions with an ended period.
 * Callable via cron with Authorization: Bearer $CRON_SECRET (every minute recommended).
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
  } else if (env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET not configured', code: 'MISCONFIGURED' }, { status: 503 })
  }

  const settings = await getBillingAutomationSettings()
  if (!settings.enabled) {
    return NextResponse.json({ ok: true, skipped: 'disabled' })
  }

  const claimed = await claimDueBillingAutomationTick()
  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: 'not_due' })
  }

  try {
    const result = await generateDueBillingInvoices(null)
    const status = result.failed > 0 && result.generated === 0 ? 'failed' : 'success'
    const updated = await recordBillingAutomationRun({
      status,
      summary: {
        trigger: 'scheduled',
        generated: result.generated,
        failed: result.failed,
        examined: result.examined,
        active_subscriptions: result.active_subscriptions,
        next_period_end: result.next_period_end,
      },
      cron: claimed.cron_expression,
      timezone: claimed.timezone,
      enabled: true,
    })
    return NextResponse.json({ ok: true, result, settings: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await recordBillingAutomationRun({
      status: 'failed',
      summary: { trigger: 'scheduled', error: message },
      cron: claimed.cron_expression,
      timezone: claimed.timezone,
      enabled: true,
    })
    return NextResponse.json(
      { ok: false, error: message, code: 'BILLING_AUTOMATION_FAILED' },
      { status: 500 },
    )
  }
}
