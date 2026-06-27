import 'server-only'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { canSettings } from '@/lib/permissions'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import type { AuthedSession } from '@/lib/api-handler'

/**
 * Gate for the org-scoped billing dashboard (the Gerente self-service view).
 *
 * Requires `settings:read` on the effective org — i.e. a built-in admin
 * (Gerente), or a sys-admin impersonating one. The resolved org id is returned
 * so callers always scope queries to the session's own org and never trust a
 * client-supplied `org_id`.
 */
export async function requireOrgBilling(): Promise<
  { session: AuthedSession; orgId: string } | { response: NextResponse }
> {
  const session = await auth()
  if (!session?.user) {
    return { response: NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }) }
  }

  const user = session.user as AuthedSession['user']
  const orgId = await resolveOrgIdForMutation({
    orgId: user.orgId,
    actingOrgId: user.actingOrgId,
    role: user.role,
    realRole: user.realRole,
  })
  if (!orgId) {
    return { response: NextResponse.json({ error: 'Sin organización activa', code: 'NO_ORG_CONTEXT' }, { status: 400 }) }
  }

  const allowed = await canSettings({ role: user.role, orgRoleId: user.orgRoleId }, 'settings:read', orgId)
  if (!allowed) {
    return { response: NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }) }
  }

  return { session: session as AuthedSession, orgId }
}
