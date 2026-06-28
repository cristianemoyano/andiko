import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { can, type Permission } from '@/lib/permissions'
import { isModuleEnabled, moduleForPermission } from '@/modules/auth/organization-settings.service'
import { resolveOrgScope } from '@/lib/session-org'
import {
  orgContextRequiredResponse,
  resolveTenantContext,
  type TenantContext,
} from '@/lib/tenancy'
import type { UserRole } from '@/types/roles'
import type { Session } from 'next-auth'
import {
  type AuthedSession,
} from '@/lib/session-actor'

export type { AuthedSession } from '@/lib/session-actor'
export { resolveActorId, requireAuthedSession } from '@/lib/session-actor'

export type RouteContext<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>
}

export type RouteHandler<P extends Record<string, string>> = (
  req: NextRequest,
  ctx: RouteContext<P>,
  session: AuthedSession,
) => Promise<NextResponse>

export type TenantRouteHandler<P extends Record<string, string>> = (
  req: NextRequest,
  ctx: RouteContext<P>,
  session: AuthedSession,
  tenant: TenantContext,
) => Promise<NextResponse>

export type OrgRouteHandler<P extends Record<string, string>> = (
  req: NextRequest,
  ctx: RouteContext<P>,
  session: AuthedSession,
  orgId: string,
) => Promise<NextResponse>

function isRealSysAdmin(session: Session): boolean {
  const user = session.user as AuthedSession['user']
  return (user.realRole ?? user.role) === 'sys-admin'
}

function effectiveOrgId(session: Session): string | null {
  const user = session.user as AuthedSession['user']
  return user.orgId ?? (isRealSysAdmin(session) ? user.actingOrgId : null) ?? null
}

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

    const user = session.user as AuthedSession['user']
    const role = user.role as UserRole
    const orgId = effectiveOrgId(session)
    const orgRoleId = user.orgRoleId ?? null

    const moduleKey = moduleForPermission(permission)
    if (moduleKey && !isRealSysAdmin(session)) {
      if (!orgId) return orgContextRequiredResponse()
      const enabled = await isModuleEnabled(orgId, moduleKey)
      if (!enabled) {
        return NextResponse.json(
          { error: 'Módulo no habilitado para esta organización.', code: 'MODULE_DISABLED' },
          { status: 403 },
        )
      }
    }

    if (!(await can(role, permission, orgId ?? undefined, orgRoleId))) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }

    return handler(req, ctx, session as AuthedSession)
  }
}

/** Like `withPermission`, but resolves tenant context (org + branch scope) before the handler. */
export function withTenantPermission<P extends Record<string, string> = Record<string, string>>(
  permission: Permission,
  handler: TenantRouteHandler<P>,
): (req: NextRequest, ctx: RouteContext<P>) => Promise<NextResponse> {
  return withPermission(permission, async (req, ctx, session) => {
    const tenant = await resolveTenantContext(session.user)
    if ('error' in tenant) return tenant.error
    return await handler(req, ctx, session, tenant.ctx)
  })
}

/**
 * Authenticated + tenant-scoped, but WITHOUT a fixed module permission gate.
 *
 * For cross-cutting resources whose authorization is relationship-based rather than
 * matrix-based (the file service: access is derived from linked records + explicit shares).
 * Gating these with a single module `Permission` would wrongly block users who legitimately
 * have access via a linked record. The per-resource decision is made in the service (ReBAC).
 */
export function withTenantAuth<P extends Record<string, string> = Record<string, string>>(
  handler: TenantRouteHandler<P>,
): (req: NextRequest, ctx: RouteContext<P>) => Promise<NextResponse> {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<NextResponse> => {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const tenant = await resolveTenantContext((session as AuthedSession).user)
    if ('error' in tenant) return tenant.error
    return handler(req, ctx, session as AuthedSession, tenant.ctx)
  }
}

/** Like `withPermission`, but resolves org id (without branch allow-list) before the handler. */
export function withOrgPermission<P extends Record<string, string> = Record<string, string>>(
  permission: Permission,
  handler: OrgRouteHandler<P>,
): (req: NextRequest, ctx: RouteContext<P>) => Promise<NextResponse> {
  return withPermission(permission, async (req, ctx, session) => {
    const orgScope = await resolveOrgScope(session.user)
    if ('error' in orgScope) return orgScope.error
    return handler(req, ctx, session, orgScope.orgId)
  })
}
