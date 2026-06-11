import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import { listActiveBranchesForOrg, listActiveBranchesForUser } from '@/modules/auth/branches.service'

/** Sucursales activas de la organización en contexto (selectores en ventas, etc.). */
export const GET = withPermission('sales:write', async (_req, _ctx, session) => {
  const orgId = await resolveOrgIdForMutation(session.user)
  if (!orgId) {
    return NextResponse.json(
      {
        error:
          'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.',
        code: 'ORG_CONTEXT_REQUIRED',
      },
      { status: 422 },
    )
  }
  const isRealSysAdmin = session.user.realRole === 'sys-admin'
  const effectiveUserId = session.user.impersonation?.userId ?? session.user.id ?? null

  const rows =
    isRealSysAdmin && session.user.impersonation === null
      ? await listActiveBranchesForOrg(orgId)
      : effectiveUserId
        ? await listActiveBranchesForUser(orgId, effectiveUserId)
        : []
  const data = rows.map(b => ({
    id:          b.id,
    org_id:      b.org_id,
    name:        b.name,
    branch_code: b.branch_code,
    address:     b.address,
    is_active:   b.is_active,
  }))
  return NextResponse.json({ data })
})
