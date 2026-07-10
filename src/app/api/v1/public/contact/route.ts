import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isCapServerConfigured, verifyCapToken } from '@/lib/cap-verify'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  message: z.string().trim().max(5000).optional(),
  capToken: z.string().optional(),
})

function web3FormsAccessKey(): string | undefined {
  return process.env.WEB3FORMS_ACCESS_KEY ?? process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY
}

export async function POST(req: Request) {
  const json: unknown = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }

  if (isCapServerConfigured()) {
    const capOk = await verifyCapToken(parsed.data.capToken ?? '')
    if (!capOk) {
      return NextResponse.json(
        { error: 'No pudimos verificar el envío. Intentá de nuevo.', code: 'CAPTCHA_FAILED' },
        { status: 422 },
      )
    }
  }

  const accessKey = web3FormsAccessKey()
  if (!accessKey) {
    return NextResponse.json(
      { error: 'El formulario no está configurado.', code: 'NOT_CONFIGURED' },
      { status: 503 },
    )
  }

  const { name, email, message } = parsed.data

  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: accessKey,
      subject: 'Acceso anticipado — Andiko (Beta privada)',
      from_name: 'Andiko Landing',
      name,
      email,
      message: message ?? '',
      botcheck: '',
    }),
    signal: AbortSignal.timeout(15_000),
  })

  const data = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string }

  if (!response.ok || !data.success) {
    return NextResponse.json(
      { error: data.message ?? 'No pudimos enviarlo. Intentá de nuevo.', code: 'SUBMIT_FAILED' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true })
}
