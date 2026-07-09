import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { emailSettingsUpdateSchema } from '@/modules/communications/email-settings.schema'
import { getPublicEmailSettings, updateEmailSettings, EmailSettingsValidationError } from '@/modules/communications/email-settings.service'

export async function GET() {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  return NextResponse.json(await getPublicEmailSettings())
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

  const parsed = emailSettingsUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const result = await updateEmailSettings(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof EmailSettingsValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 })
    }
    throw err
  }
}
