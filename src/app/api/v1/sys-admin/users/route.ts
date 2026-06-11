import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { searchUsersForSysAdmin } from '@/modules/auth/impersonation.service'

const querySchema = z.object({
  q: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return undefined
      const t = v.trim()
      return t === '' ? undefined : t
    },
    z.string().min(1).max(200).optional(),
  ),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

/**
 * Search non–sys-admin users for impersonation (sys-admin only, real account).
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (session.user.realRole !== 'sys-admin') {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries())
  const parsed = querySchema.safeParse(sp)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { q, limit } = parsed.data
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ data: [] as const })
  }

  const data = await searchUsersForSysAdmin(q, limit)
  return NextResponse.json({ data })
}
