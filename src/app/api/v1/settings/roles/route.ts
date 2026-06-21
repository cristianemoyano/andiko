import { NextResponse } from 'next/server'
import { withSettingsPermission } from '@/lib/settings-guard'
import { orgRoleCreateSchema } from '@/modules/auth/org-roles.schema'
import { createOrgRole } from '@/modules/auth/org-roles.service'

export const POST = withSettingsPermission('settings:write', async (req, _ctx, _session, orgId) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = orgRoleCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const role = await createOrgRole(orgId, parsed.data)
    return NextResponse.json(
      { id: role.id, name: role.name, allows_pos: role.allows_pos },
      { status: 201 },
    )
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_ROLE_NAME_TAKEN') {
      return NextResponse.json({ error: 'Ya existe un rol con ese nombre', code: 'DUPLICATE_NAME' }, { status: 409 })
    }
    throw err
  }
})
