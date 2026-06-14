import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { emailTestSchema } from '@/modules/communications/email-settings.schema'
import {
  sendTestEmail,
  SMTP_NOT_CONFIGURED,
  EMAIL_TEST_FAILED,
} from '@/modules/communications/send-test.service'

export async function POST(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = emailTestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const result = await sendTestEmail(parsed.data.to)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === SMTP_NOT_CONFIGURED) {
      return NextResponse.json(
        {
          error:
            'No hay una configuración SMTP habilitada. Activá el envío y guardá la configuración antes de probar.',
          code: SMTP_NOT_CONFIGURED,
        },
        { status: 409 },
      )
    }
    if (err instanceof Error && err.message === EMAIL_TEST_FAILED) {
      const detail = (err as Error & { detail?: string }).detail ?? 'Error desconocido'
      return NextResponse.json(
        { error: `No se pudo enviar el email de prueba: ${detail}`, code: EMAIL_TEST_FAILED },
        { status: 502 },
      )
    }
    throw err
  }
}
