import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { billerSettingsUpdateSchema } from '@/modules/billing/platform-billing-settings.schema'
import { getBillerSettings, updateBillerSettings } from '@/modules/billing/platform-billing-settings.service'

/** Platform issuer ("emisor") details used on subscription invoices billed to orgs. */
export async function GET() {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  return NextResponse.json(await getBillerSettings())
}

export async function PUT(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = billerSettingsUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const result = await updateBillerSettings(parsed.data)
  return NextResponse.json(result)
}
