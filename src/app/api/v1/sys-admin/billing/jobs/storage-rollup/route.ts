import { NextResponse } from 'next/server'
import { env } from '@/config/env'
import { runStorageUsageRollup } from '@/modules/billing/storage-usage.service'

/**
 * Storage metering job: snapshots each org's storage footprint (bytes → storage_gb, object count
 * → storage_files) into usage_records for the current billing period. Meter-only — never blocks.
 * Callable via cron with Authorization: Bearer $CRON_SECRET, or manually in dev. Idempotent within
 * a period, so it's safe to run daily.
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

  const result = await runStorageUsageRollup()
  return NextResponse.json({ ok: true, ...result })
}
