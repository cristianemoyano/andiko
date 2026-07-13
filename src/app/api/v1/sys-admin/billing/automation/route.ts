import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { billingAutomationUpdateSchema } from '@/modules/billing/billing-automation-settings.schema'
import {
  getBillingAutomationSettings,
  updateBillingAutomationSettings,
} from '@/modules/billing/billing-automation-settings.service'

/** Platform billing invoice automation schedule (sys-admin only). */
export async function GET() {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  return NextResponse.json(await getBillingAutomationSettings())
}

export async function PATCH(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = billingAutomationUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const result = await updateBillingAutomationSettings(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.startsWith('INVALID_CRON:')) {
      return NextResponse.json(
        { error: message.slice('INVALID_CRON:'.length), code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }
    throw err
  }
}
