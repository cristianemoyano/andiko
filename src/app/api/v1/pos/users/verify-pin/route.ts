import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { withPosDevice } from '@/lib/pos-auth'
import { listPosCashierUsers } from '@/modules/pos/pos-cashier-eligibility'
import { clearThrottle, isThrottled, recordFailedAttempt } from '@/lib/rate-limit'

const bodySchema = z.object({
  user_id: z.string().uuid(),
  pin: z.string().min(4).max(12),
})

const PIN_THROTTLE = { maxAttempts: 5, windowSeconds: 5 * 60, lockSeconds: 5 * 60 }

export const POST = withPosDevice(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  const throttleKey = `pos-pin:${ctx.deviceRowId}:${parsed.data.user_id}`
  const throttled = await isThrottled(throttleKey)
  if (throttled.blocked) {
    return NextResponse.json(
      { ok: false, error: 'TOO_MANY_ATTEMPTS', retry_after_seconds: throttled.retryAfterSeconds },
      { status: 429 },
    )
  }

  const [user] = await listPosCashierUsers(ctx.orgId, ctx.branchId, {
    userId: parsed.data.user_id,
    limit: 1,
  })

  if (!user || !user.pos_pin_hash) {
    await recordFailedAttempt(throttleKey, PIN_THROTTLE)
    return NextResponse.json({ ok: false, error: 'INVALID_PIN' }, { status: 401 })
  }

  const ok = await bcrypt.compare(parsed.data.pin, user.pos_pin_hash)
  if (!ok) {
    await recordFailedAttempt(throttleKey, PIN_THROTTLE)
    return NextResponse.json({ ok: false, error: 'INVALID_PIN' }, { status: 401 })
  }

  await clearThrottle(throttleKey)
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name } }, { status: 200 })
})

