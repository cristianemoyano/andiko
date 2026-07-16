import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resetPassword } from '@/modules/auth/password-reset.service'

const confirmSchema = z.object({
  token: z.string().min(20).max(512),
  password: z.string().min(8).max(128),
})

const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_INVALID: 'El enlace no es válido.',
  TOKEN_EXPIRED: 'El enlace venció. Solicitá uno nuevo.',
  TOKEN_USED: 'Este enlace ya fue utilizado. Solicitá uno nuevo.',
  USER_INACTIVE: 'La cuenta no está activa.',
}

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = confirmSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.password)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : ''
    const message = ERROR_MESSAGES[code]
    if (message) {
      return NextResponse.json({ error: message, code }, { status: 400 })
    }
    throw err
  }
}
