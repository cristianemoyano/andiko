import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Op } from 'sequelize'
import { withPosDevice } from '@/lib/pos-auth'
import Contact from '@/modules/contacts/contact.model'

const querySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
})

export const GET = withPosDevice(async (req: NextRequest, ctx) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { since } = parsed.data
  const where: Record<string, unknown> = {
    org_id: ctx.orgId,
    type: { [Op.in]: ['customer', 'both'] },
    is_active: true,
    deleted_at: null,
  }

  if (since) {
    where['updated_at'] = { [Op.gt]: new Date(since) }
  }

  const contacts = await Contact.findAll({
    where,
    attributes: [
      'id', 'legal_name', 'trade_name', 'cuit', 'iva_condition', 'email', 'phone',
      'is_system', 'system_key', 'updated_at',
    ],
    limit: 5000,
  })

  return NextResponse.json({ data: contacts, count: contacts.length })
})
