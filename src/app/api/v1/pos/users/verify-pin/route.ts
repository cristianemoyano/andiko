import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Op } from 'sequelize'
import bcrypt from 'bcryptjs'
import { withPosDevice } from '@/lib/pos-auth'
import User from '@/modules/auth/user.model'

const bodySchema = z.object({
  user_id: z.string().uuid(),
  pin: z.string().min(4).max(12),
})

export const POST = withPosDevice(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  const where: Record<string, unknown> = {
    id: parsed.data.user_id,
    org_id: ctx.orgId,
    is_active: true,
    deleted_at: null,
    role: { [Op.in]: ['operator', 'admin'] },
  }

  if (ctx.branchId) {
    where['branch_id'] = { [Op.or]: [ctx.branchId, null] }
  }

  const user = await User.findOne({
    where,
    attributes: ['id', 'name', 'pos_pin_hash'],
  })

  if (!user || !user.pos_pin_hash) {
    return NextResponse.json({ ok: false, error: 'INVALID_PIN' }, { status: 401 })
  }

  const ok = await bcrypt.compare(parsed.data.pin, user.pos_pin_hash)
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'INVALID_PIN' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name } }, { status: 200 })
})

