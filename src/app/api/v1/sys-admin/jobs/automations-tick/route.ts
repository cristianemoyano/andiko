import { NextResponse } from 'next/server'
import { env } from '@/config/env'
import { runDueScheduledTasks } from '@/modules/automations/scheduled-task-runner.service'

/**
 * Automations tick: claims and runs every due `scheduled_tasks` row across all orgs.
 * Meant to be hit once a minute by an external cron with
 * Authorization: Bearer $CRON_SECRET. Safe to call concurrently (overlapping ticks,
 * multiple app replicas) — claiming uses optimistic concurrency, so a row is never
 * processed twice.
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

  const result = await runDueScheduledTasks()
  return NextResponse.json({ ok: true, ...result })
}
