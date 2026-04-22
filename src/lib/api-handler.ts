import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { can, type Permission } from '@/lib/permissions'
import type { UserRole } from '@/types/roles'
import type { Session } from 'next-auth'

export type AuthedSession = Session & {
  user: NonNullable<Session['user']> & {
    role: UserRole
    orgId: string | null
    branchId: string | null
    actingOrgId: string | null
    realRole: UserRole
  }
}

export type RouteContext<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>
}

export type RouteHandler<P extends Record<string, string>> = (
  req: NextRequest,
  ctx: RouteContext<P>,
  session: AuthedSession,
) => Promise<NextResponse>

/**
 * Wraps a Next.js App Router route handler with auth + permission check.
 *
 * Usage:
 *   export const GET  = withPermission('contacts:read',  async (req, ctx, session) => { ... })
 *   export const POST = withPermission('contacts:write', async (req, ctx, session) => { ... })
 */
export function withPermission<P extends Record<string, string> = Record<string, string>>(
  permission: Permission,
  handler: RouteHandler<P>,
): (req: NextRequest, ctx: RouteContext<P>) => Promise<NextResponse> {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<NextResponse> => {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      )
    }

    const role  = session.user.role as UserRole
    const orgId = (session.user as AuthedSession['user']).orgId ?? undefined

    if (!(await can(role, permission, orgId))) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }

    return handler(req, ctx, session as AuthedSession)
  }
}
