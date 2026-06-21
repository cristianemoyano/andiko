import { NextResponse } from 'next/server'
import { withSettingsPermission } from '@/lib/settings-guard'
import { branchUpdateSchema } from '@/modules/auth/tenancy-admin.schema'
import {
  assertBranchBelongsToOrg,
  updateBranch,
} from '@/modules/auth/tenancy-admin.service'
import { deleteBranchWithGuard } from '@/modules/auth/org-users.service'

type P = { id: string }

export const PATCH = withSettingsPermission('settings:write', async (req, ctx, _session, orgId) => {
  const { id } = await ctx.params as P
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = branchUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    await assertBranchBelongsToOrg(orgId, id)
    const branch = await updateBranch(id, parsed.data)
    return NextResponse.json({
      id: branch.id,
      org_id: branch.org_id,
      branch_code: branch.branch_code,
      name: branch.name,
      address: branch.address,
      is_active: branch.is_active,
    })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'BRANCH_NOT_FOUND' || err.message === 'BRANCH_NOT_IN_ORG')) {
      return NextResponse.json({ error: 'Sucursal no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withSettingsPermission('settings:write', async (_req, ctx, _session, orgId) => {
  const { id } = await ctx.params as P
  try {
    await deleteBranchWithGuard(orgId, id)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'BRANCH_NOT_FOUND' || err.message === 'BRANCH_NOT_IN_ORG')) {
      return NextResponse.json({ error: 'Sucursal no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (err instanceof Error && err.message === 'LAST_BRANCH') {
      return NextResponse.json(
        { error: 'No podés eliminar la última sucursal activa de la organización', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }
    throw err
  }
})
