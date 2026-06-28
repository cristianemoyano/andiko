import { NextResponse } from 'next/server'
import { env } from '@/config/env'
import { runSyncTick } from '@/modules/integrations/woocommerce/woo-sync-worker.service'

/**
 * WooCommerce sync tick: poll all active sites for new orders and drain the
 * outbox (stock/product/order jobs). Callable via cron with
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

  const result = await runSyncTick()
  return NextResponse.json({ ok: true, ...result })
}
