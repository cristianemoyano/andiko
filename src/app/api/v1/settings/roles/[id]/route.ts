import { NextResponse } from 'next/server'
import { withSettingsPermission } from '@/lib/settings-guard'
import { orgRoleUpdateSchema } from '@/modules/auth/org-roles.schema'
import { deleteOrgRole, updateOrgRole } from '@/modules/auth/org-roles.service'

type P = { id: string }

export const PATCH = withSettingsPermission('settings:write', async (req, ctx, _session, orgId) => {
  const { id } = await ctx.params as P
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = orgRoleUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const role = await updateOrgRole(orgId, id, parsed.data)
    return NextResponse.json({ id: role.id, name: role.name, allows_pos: role.allows_pos })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'ORG_ROLE_NOT_FOUND') {
        return NextResponse.json({ error: 'Rol no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'ORG_ROLE_NAME_TAKEN') {
        return NextResponse.json({ error: 'Ya existe un rol con ese nombre', code: 'DUPLICATE_NAME' }, { status: 409 })
      }
    }
    throw err
  }
})

export const DELETE = withSettingsPermission('settings:write', async (_req, ctx, _session, orgId) => {
  const { id } = await ctx.params as P
  try {
    await deleteOrgRole(orgId, id)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'ORG_ROLE_NOT_FOUND') {
        return NextResponse.json({ error: 'Rol no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'ORG_ROLE_IN_USE') {
        return NextResponse.json(
          { error: 'No podés eliminar un rol con usuarios asignados', code: 'CONFLICT' },
          { status: 409 },
        )
      }
    }
    throw err
  }
})
