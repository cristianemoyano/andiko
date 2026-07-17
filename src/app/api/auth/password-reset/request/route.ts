import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requestPasswordReset } from '@/modules/auth/password-reset.service'

const requestSchema = z.object({
  email: z.string().email('Dirección de correo inválida').max(320),
})

/**
 * Always responds 200 `{ ok: true }` regardless of whether the email is
 * registered — never branch this response on `requestPasswordReset`'s
 * internal outcome, to avoid leaking which emails exist.
 */
export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  await requestPasswordReset(parsed.data.email)
  return NextResponse.json({ ok: true })
}
