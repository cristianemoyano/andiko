import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import PosCashSession from '@/modules/pos/pos-cash-session.model'
import { Op } from 'sequelize'

const querySchema = z.object({
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().min(1).max(200).default(50),
  branch_id:  z.string().uuid().optional(),
  status:     z.enum(['open', 'closed']).optional(),
  from:       z.string().date().optional(),
  to:         z.string().date().optional(),
})

export const GET = withPermission('inventory:read', async (req: NextRequest, _ctx, session) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
  const { page, limit, branch_id, status, from, to } = parsed.data
  const offset = (page - 1) * limit

  const where: Record<string, unknown> = { org_id: ctx.orgId }
  if (branch_id) where['branch_id'] = branch_id
  if (status)    where['status'] = status
  if (from || to) {
    const dateFilter: Record<string, unknown> = {}
    if (from) dateFilter[Op.gte as unknown as string] = new Date(`${from}T00:00:00Z`)
    if (to)   dateFilter[Op.lte as unknown as string] = new Date(`${to}T23:59:59Z`)
    where['opened_at'] = dateFilter
  }

  const { rows: data, count } = await PosCashSession.findAndCountAll({
    where,
    order: [['opened_at', 'DESC']],
    limit,
    offset,
  })

  return NextResponse.json({
    data: data.map(s => ({
      id:                      s.id,
      branch_id:               s.branch_id,
      cashier_name:            s.cashier_name,
      opened_at:               s.opened_at,
      closed_at:               s.closed_at,
      opening_amount:          s.opening_amount,
      closing_amount_declared: s.closing_amount_declared,
      closing_amount_expected: s.closing_amount_expected,
      difference:              s.difference,
      status:                  s.status,
    })),
    total: count,
    page,
    limit,
  })
})
