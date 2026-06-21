import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import {
  requireSettingsPermission,
  type SettingsPermission,
} from '@/lib/permissions'
import type { UserRole } from '@/types/roles'

export type SettingsSession = Session & {
  user: NonNullable<Session['user']> & {
    role: UserRole
    orgId: string | null
    orgRoleId?: string | null
    realRole: UserRole
  }
}

export async function requireSettingsAccess(
  permission: SettingsPermission,
): Promise<
  { session: SettingsSession; orgId: string } | { response: NextResponse }
> {
  const session = await auth()
  if (!session?.user) {
    return { response: NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }) }
  }

  const orgId = await resolveOrgIdForMutation({
    orgId: session.user.orgId,
    actingOrgId: session.user.actingOrgId,
    role: session.user.role,
    realRole: session.user.realRole,
  })

  if (!orgId) {
    return {
      response: NextResponse.json(
        { error: 'No hay organización en contexto', code: 'ORG_CONTEXT_REQUIRED' },
        { status: 422 },
      ),
    }
  }

  try {
    await requireSettingsPermission(
      {
        role: session.user.role as UserRole,
        orgRoleId: session.user.orgRoleId ?? null,
      },
      permission,
      orgId,
    )
  } catch {
    return { response: NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }) }
  }

  return { session: session as SettingsSession, orgId }
}

type SettingsRouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  session: SettingsSession,
  orgId: string,
) => Promise<NextResponse>

export function withSettingsPermission(
  permission: SettingsPermission,
  handler: SettingsRouteHandler,
) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const gate = await requireSettingsAccess(permission)
    if ('response' in gate) return gate.response
    return handler(req, ctx, gate.session, gate.orgId)
  }
}
