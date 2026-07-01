import { NextResponse } from 'next/server'
import { env } from '@/config/env'
import { expireOverdueQuotes } from '@/modules/sales/sales-quote-expiration.service'

/**
 * Daily quote-expiration job: marks sales quotes `expired` once `valid_until` passes
 * for quotes still in `draft`/`sent`. Callable via cron with
 * Authorization: Bearer $CRON_SECRET, or manually in dev.
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
  } else if (env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET not configured', code: 'MISCONFIGURED' }, { status: 503 })
  }

  const result = await expireOverdueQuotes()
  return NextResponse.json({ ok: true, ...result })
}
