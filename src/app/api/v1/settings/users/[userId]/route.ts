import { NextResponse } from 'next/server'
import { withSettingsPermission } from '@/lib/settings-guard'
import { orgUserMutationErrorResponse } from '@/lib/org-users-api-errors'
import { resolveOrgUserMutationActor } from '@/lib/org-user-mutation-actor'
import { parseOrgUserUpdateInput } from '@/modules/auth/org-users.schema'
import { softDeleteOrgUser, updateOrgUser } from '@/modules/auth/org-users.service'

type P = { userId: string }

export const PATCH = withSettingsPermission('settings:write', async (req, ctx, session, orgId) => {
  const { userId } = await ctx.params as P
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = parseOrgUserUpdateInput(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Sin cambios', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  try {
    await updateOrgUser(orgId, userId, parsed.data, resolveOrgUserMutationActor(session))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const mapped = orgUserMutationErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
})

export const DELETE = withSettingsPermission('settings:write', async (_req, ctx, session, orgId) => {
  const { userId } = await ctx.params as P
  try {
    await softDeleteOrgUser(orgId, userId, resolveOrgUserMutationActor(session))
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const mapped = orgUserMutationErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
})
