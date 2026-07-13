import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import {
  getBillingAutomationSettings,
  recordBillingAutomationRun,
} from '@/modules/billing/billing-automation-settings.service'
import { generateDueBillingInvoices } from '@/modules/billing/billing-generate-due.service'

/** Manually run billing due-invoice generation (sys-admin). */
export async function POST() {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const settings = await getBillingAutomationSettings()
  const actorId = (gate.session.user.id as string | undefined) ?? null

  try {
    const result = await generateDueBillingInvoices(actorId)
    const status = result.failed > 0 && result.generated === 0 ? 'failed' : 'success'
    const updated = await recordBillingAutomationRun({
      status,
      summary: {
        trigger: 'manual',
        generated: result.generated,
        failed: result.failed,
        examined: result.examined,
        active_subscriptions: result.active_subscriptions,
        next_period_end: result.next_period_end,
      },
      cron: settings.cron_expression,
      timezone: settings.timezone,
      enabled: settings.enabled,
    })
    return NextResponse.json({ ok: true, result, settings: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await recordBillingAutomationRun({
      status: 'failed',
      summary: { trigger: 'manual', error: message },
      cron: settings.cron_expression,
      timezone: settings.timezone,
      enabled: settings.enabled,
    })
    return NextResponse.json(
      { error: message, code: 'BILLING_AUTOMATION_FAILED' },
      { status: 500 },
    )
  }
}
