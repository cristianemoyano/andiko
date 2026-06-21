import { NextResponse } from 'next/server'
import { withSettingsPermission } from '@/lib/settings-guard'
import {
  orgRoleMatrixUpdateSchema,
} from '@/modules/auth/org-roles.schema'
import {
  listOrgRolesMatrix,
  updateOrgRolesMatrix,
} from '@/modules/auth/org-roles.service'

export const GET = withSettingsPermission('settings:read', async (_req, _ctx, _session, orgId) => {
  const matrix = await listOrgRolesMatrix(orgId)
  return NextResponse.json(matrix)
})

export const PATCH = withSettingsPermission('settings:write', async (req, _ctx, _session, orgId) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = orgRoleMatrixUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const matrix = await updateOrgRolesMatrix(orgId, parsed.data)
    return NextResponse.json(matrix)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'ORG_ROLE_NOT_FOUND') {
        return NextResponse.json({ error: 'Rol no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'SETTINGS_PERMISSION_NOT_ASSIGNABLE' || err.message === 'INVALID_PERMISSION') {
        return NextResponse.json({ error: 'Permiso no asignable', code: 'VALIDATION_ERROR' }, { status: 422 })
      }
    }
    throw err
  }
})
