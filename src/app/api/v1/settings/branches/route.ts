import { NextResponse } from 'next/server'
import { withSettingsPermission } from '@/lib/settings-guard'
import { branchCreateSchema } from '@/modules/auth/tenancy-admin.schema'
import { createBranch, getOrganizationDetailForTenant } from '@/modules/auth/tenancy-admin.service'

export const GET = withSettingsPermission('settings:read', async (_req, _ctx, _session, orgId) => {
  const detail = await getOrganizationDetailForTenant(orgId)
  return NextResponse.json({ data: detail.branches })
})

export const POST = withSettingsPermission('settings:write', async (req, _ctx, _session, orgId) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = branchCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const branch = await createBranch(orgId, parsed.data)
    return NextResponse.json(
      {
        id: branch.id,
        org_id: branch.org_id,
        branch_code: branch.branch_code,
        name: branch.name,
        address: branch.address,
        is_active: branch.is_active,
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_NOT_FOUND') {
      return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (err instanceof Error && err.message === 'BRANCH_CODE_EXHAUSTED') {
      return NextResponse.json(
        { error: 'Se alcanzó el máximo de sucursales numerables para esta organización.', code: 'BRANCH_CODE_EXHAUSTED' },
        { status: 409 },
      )
    }
    throw err
  }
})
