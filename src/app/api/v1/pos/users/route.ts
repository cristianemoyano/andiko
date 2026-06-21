import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Op } from 'sequelize'
import { withPosDevice } from '@/lib/pos-auth'
import User from '@/modules/auth/user.model'

const querySchema = z.object({
  q: z.string().optional(),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const GET = withPosDevice(async (req: NextRequest, ctx) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const q = (parsed.data.q ?? '').trim()
  const since = parsed.data.since ? new Date(parsed.data.since) : null
  const limit = parsed.data.limit ?? 20

  const where: Record<string, unknown> & Record<symbol, unknown> = {
    org_id: ctx.orgId,
    is_active: true,
    deleted_at: null,
    role: { [Op.in]: ['operator', 'admin', 'branch-admin'] },
  }

  // If device is bound to a branch, restrict to that branch or global users (branch_id null)
  if (ctx.branchId) {
    where['branch_id'] = { [Op.or]: [ctx.branchId, null] }
  }

  if (q) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${q}%` } },
      { email: { [Op.iLike]: `%${q}%` } },
    ]
  }

  if (since) {
    where['updated_at'] = { [Op.gt]: since }
  }

  const rows = await User.findAll({
    where,
    attributes: ['id', 'name', 'email', 'role', 'branch_id', 'updated_at', 'pos_pin_hash'],
    order: [['name', 'ASC']],
    limit,
  })

  return NextResponse.json({
    data: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      branch_id: u.branch_id,
      updated_at: (u.updated_at as unknown as Date).toISOString(),
      pos_pin_hash: u.pos_pin_hash,
    })),
    count: rows.length,
  })
})

