import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Op } from 'sequelize'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import OrganizationSetting from '@/modules/auth/organization-setting.model'
import User from '@/modules/auth/user.model'

const configUpdateSchema = z.object({
  recipient_user_ids: z.array(z.string().uuid()).max(50),
})

export const GET = withPermission('settings:read', async (_req, _ctx, session) => {
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error

  const setting = await OrganizationSetting.findOne({
    where: { org_id: orgScope.orgId },
    attributes: ['low_stock_alert_recipient_user_ids'],
  })
  return NextResponse.json({
    recipient_user_ids: setting?.low_stock_alert_recipient_user_ids ?? [],
  })
})

export const PUT = withPermission('settings:write', async (req, _ctx, session) => {
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = configUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const ids = parsed.data.recipient_user_ids
  if (ids.length > 0) {
    const validUsers = await User.findAll({ where: { id: { [Op.in]: ids }, org_id: orgId }, attributes: ['id'] })
    if (validUsers.length !== ids.length) {
      return NextResponse.json(
        { error: 'Alguno de los usuarios seleccionados no pertenece a la organización', code: 'INVALID_RECIPIENT' },
        { status: 422 },
      )
    }
  }

  const existing = await OrganizationSetting.findOne({ where: { org_id: orgId } })
  if (existing) {
    await existing.update({ low_stock_alert_recipient_user_ids: ids })
  } else {
    await OrganizationSetting.create({ org_id: orgId, low_stock_alert_recipient_user_ids: ids })
  }

  return NextResponse.json({ recipient_user_ids: ids })
})
