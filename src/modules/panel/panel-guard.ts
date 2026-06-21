import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPermissionsForUser } from '@/lib/permissions'
import { hasPanelAccess } from '@/lib/panel-access'
import type { AuthedSession, RouteContext, RouteHandler } from '@/lib/api-handler'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import type { PanelFilters } from '@/modules/panel/panel.service'

export function applyPanelBranchScope(session: AuthedSession, filters: PanelFilters): PanelFilters {
  if (session.user.role === 'branch-admin' && session.user.branchId) {
    return { ...filters, branch_id: session.user.branchId }
  }
  return filters
}

export function withPanelAccess<P extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<P>,
): (req: NextRequest, ctx: RouteContext<P>) => Promise<NextResponse> {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<NextResponse> => {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const authed = session as AuthedSession
    const orgId = await resolveOrgIdForMutation(authed.user)
    if (!orgId) {
      return NextResponse.json(
        { error: 'No hay organización en contexto', code: 'ORG_CONTEXT_REQUIRED' },
        { status: 422 },
      )
    }

    const perms = await getPermissionsForUser(
      { role: authed.user.role, orgRoleId: authed.user.orgRoleId ?? null },
      orgId,
    )
    if (!hasPanelAccess(perms)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    return handler(req, ctx, authed)
  }
}
