import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { can, type Permission } from '@/lib/permissions'
import { isModuleEnabled, moduleForPermission } from '@/modules/auth/organization-settings.service'
import { resolveOrgScope } from '@/lib/session-org'
import { shouldBlockSuspendedApiRequest } from '@/lib/suspension-guard'
import { isOrgSuspended } from '@/modules/billing/subscription-access.service'
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
 * Backstop del gate de suscripción `past_due`: bloquea mutaciones (todo lo que no sea
 * GET/HEAD/OPTIONS) cuando la org efectiva está suspendida. Las lecturas quedan abiertas
 * y los sys-admin reales (incluso impersonando) están exentos. `/api/v1/billing/*` usa
 * `requireOrgBilling` (no estos wrappers), así que pagar la suscripción sigue posible.
 */
async function suspendedOrgResponse(req: NextRequest, session: Session): Promise<NextResponse | null> {
  if (!shouldBlockSuspendedApiRequest(req.method)) return null
  if (isRealSysAdmin(session)) return null
  const orgId = effectiveOrgId(session)
  if (!orgId) return null
  if (!(await isOrgSuspended(orgId))) return null
  return NextResponse.json(
    { error: 'Suscripción suspendida por falta de pago.', code: 'SUBSCRIPTION_SUSPENDED' },
    { status: 403 },
  )
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

    const suspendedRes = await suspendedOrgResponse(req, session)
    if (suspendedRes) return suspendedRes

    try {
      return await handler(req, ctx, session as AuthedSession)
    } catch (err) {
      return handleApiError(err)
    }
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

/** Tenant-scoped route that accepts any one of the listed permissions (first match wins). */
export function withTenantAnyPermission<P extends Record<string, string> = Record<string, string>>(
  permissions: Permission[],
  handler: TenantRouteHandler<P>,
): (req: NextRequest, ctx: RouteContext<P>) => Promise<NextResponse> {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<NextResponse> => {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const user = session.user as AuthedSession['user']
    const role = user.role as UserRole
    const orgId = effectiveOrgId(session)
    const orgRoleId = user.orgRoleId ?? null

    let allowed = false
    for (const permission of permissions) {
      const moduleKey = moduleForPermission(permission)
      if (moduleKey && !isRealSysAdmin(session)) {
        if (!orgId) return orgContextRequiredResponse()
        if (!(await isModuleEnabled(orgId, moduleKey))) continue
      }
      if (await can(role, permission, orgId ?? undefined, orgRoleId)) {
        allowed = true
        break
      }
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    const suspendedRes = await suspendedOrgResponse(req, session)
    if (suspendedRes) return suspendedRes

    const tenant = await resolveTenantContext(session.user)
    if ('error' in tenant) return tenant.error
    try {
      return await handler(req, ctx, session as AuthedSession, tenant.ctx)
    } catch (err) {
      return handleApiError(err)
    }
  }
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

    const suspendedRes = await suspendedOrgResponse(req, session)
    if (suspendedRes) return suspendedRes

    const tenant = await resolveTenantContext((session as AuthedSession).user)
    if ('error' in tenant) return tenant.error
    try {
      return await handler(req, ctx, session as AuthedSession, tenant.ctx)
    } catch (err) {
      return handleApiError(err)
    }
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
