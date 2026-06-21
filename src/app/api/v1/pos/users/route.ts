import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withPosDevice } from '@/lib/pos-auth'
import { listPosCashierUsers } from '@/modules/pos/pos-cashier-eligibility'

const querySchema = z.object({
  q: z.string().optional(),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const GET = withPosDevice(async (req: NextRequest, ctx) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const rows = await listPosCashierUsers(ctx.orgId, ctx.branchId, {
    q: parsed.data.q,
    since: parsed.data.since ? new Date(parsed.data.since) : null,
    limit: parsed.data.limit,
  })

  return NextResponse.json({
    data: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      role_label: u.role_label,
      branch_id: u.branch_id,
      updated_at: u.updated_at.toISOString(),
      pos_pin_hash: u.pos_pin_hash,
    })),
    count: rows.length,
  })
})
