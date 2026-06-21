import { NextResponse } from 'next/server'
import { withSettingsPermission } from '@/lib/settings-guard'
import { orgUserMutationErrorResponse } from '@/lib/org-users-api-errors'
import { parseOrgUserCreateInput } from '@/modules/auth/org-users.schema'
import { createOrgUser, listOrgUsers } from '@/modules/auth/org-users.service'

export const GET = withSettingsPermission('settings:read', async (_req, _ctx, _session, orgId) => {
  const data = await listOrgUsers(orgId)
  return NextResponse.json({ data })
})

export const POST = withSettingsPermission('settings:write', async (req, _ctx, session, orgId) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = parseOrgUserCreateInput(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const user = await createOrgUser(orgId, parsed.data)
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
  } catch (err: unknown) {
    const mapped = orgUserMutationErrorResponse(err)
    if (mapped) return mapped
    throw err
  }
})
