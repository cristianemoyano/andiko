import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withPosDevice } from '@/lib/pos-auth'
import { PosPaymentMethod, PosBranchPaymentMethod } from '@/modules/pos/pos-payment-method.model'

const querySchema = z.object({
  branch_id: z.string().uuid(),
})

export const GET = withPosDevice(async (req: NextRequest, ctx) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'branch_id requerido', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { branch_id } = parsed.data

  const rows = await PosBranchPaymentMethod.findAll({
    where: { org_id: ctx.orgId, branch_id, is_active: true },
    include: [
      {
        model: PosPaymentMethod,
        as: 'paymentMethod',
        where: { org_id: ctx.orgId, is_active: true },
        attributes: ['id', 'name', 'type', 'requires_reference', 'sort_order', 'updated_at'],
      },
    ],
    order: [[{ model: PosPaymentMethod, as: 'paymentMethod' }, 'sort_order', 'ASC']],
  })

  const data = rows.map((r) => {
    const pm = (r as unknown as { paymentMethod: PosPaymentMethod & { updated_at: Date } }).paymentMethod
    return {
      id: pm.id,
      name: pm.name,
      type: pm.type,
      requires_reference: pm.requires_reference,
      sort_order: pm.sort_order,
      updated_at: pm.updated_at.toISOString(),
    }
  })

  return NextResponse.json({ data, count: data.length })
})
