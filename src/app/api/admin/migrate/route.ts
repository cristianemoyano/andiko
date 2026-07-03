import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { env } from '@/config/env'

function isValidToken(token: string, secret: string): boolean {
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Protected migration endpoint — only for production use after deploys.
// Requires Authorization: Bearer <MIGRATION_SECRET> header.
// MIGRATION_SECRET must be at least 32 chars and set in Vercel env vars.
export async function POST(req: Request) {
  if (!env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'MIGRATION_SECRET not configured' }, { status: 503 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!isValidToken(token, env.MIGRATION_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { umzug } = await import('@/lib/migrations')
    const pending = await umzug.pending()
    if (pending.length === 0) {
      return NextResponse.json({ status: 'ok', message: 'No pending migrations', migrated: [] })
    }

    const migrated = await umzug.up()
    return NextResponse.json({
      status: 'ok',
      message: `Ran ${migrated.length} migration(s)`,
      migrated: migrated.map(m => m.name),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
