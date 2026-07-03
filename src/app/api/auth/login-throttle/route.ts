import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isThrottled } from '@/lib/rate-limit'

const querySchema = z.object({
  email: z.string().email(),
})

/** Returns remaining lockout seconds for a login email, if throttled. */
export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get('email')
  const parsed = querySchema.safeParse({ email })
  if (!parsed.success) {
    return NextResponse.json({ retryAfterSeconds: null })
  }

  const status = await isThrottled(`login:${parsed.data.email.toLowerCase()}`)
  return NextResponse.json({
    retryAfterSeconds: status.blocked ? status.retryAfterSeconds : null,
  })
}
