import 'server-only'

import { NextResponse } from 'next/server'
import { Op } from 'sequelize'
import type { AuthedSession } from '@/lib/session-actor'

export const TENANCY_ERROR_CODES = {
  ORG_CONTEXT_REQUIRED: 'ORG_CONTEXT_REQUIRED',
  BRANCH_REQUIRED: 'BRANCH_REQUIRED',
  BRANCH_NOT_ALLOWED: 'BRANCH_NOT_ALLOWED',
} as const

export const ORG_CONTEXT_REQUIRED_MESSAGE =
  'No hay organización en contexto. Como sys-admin, elegí una en la barra lateral (Contexto ERP). El resto de los usuarios necesita una organización asignada en su cuenta.'

export type TenancyErrorCode = (typeof TENANCY_ERROR_CODES)[keyof typeof TENANCY_ERROR_CODES]

export class TenancyError extends Error {
  readonly code: TenancyErrorCode
  constructor(code: TenancyErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'TenancyError'
    this.code = code
  }
}

export type TenantContext = {
  orgId: string
  userId: string
  /** Default branch for this identity (impersonated or real). */
  defaultBranchId: string | null
  /** Branches allowed for reads+writes. */
  allowedBranchIds: string[]
  /** When true, sales document lists/detail are limited to the logged-in salesperson. */
  salesScopeOwn?: boolean
}

export function orgContextRequiredResponse(): NextResponse {
  return NextResponse.json(
    { error: ORG_CONTEXT_REQUIRED_MESSAGE, code: TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED },
    { status: 422 },
  )
}

const TENANCY_ERROR_RESPONSES: Record<TenancyErrorCode, { error: string; status: number }> = {
  [TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED]: {
    error: ORG_CONTEXT_REQUIRED_MESSAGE,
    status: 422,
  },
  [TENANCY_ERROR_CODES.BRANCH_REQUIRED]: {
    error: 'La sucursal es obligatoria.',
    status: 422,
  },
  [TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED]: {
    error: 'No tenés acceso a la sucursal indicada.',
    status: 403,
  },
}

/** Maps tenancy errors to structured API responses, or null when not a TenancyError. */
export function tenancyErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof TenancyError)) return null
  const mapped = TENANCY_ERROR_RESPONSES[err.code]
  if (!mapped) return null
  return NextResponse.json({ error: mapped.error, code: err.code }, { status: mapped.status })
}

export async function resolveTenantContext(
  user: AuthedSession['user'],
): Promise<{ ctx: TenantContext } | { error: NextResponse }> {
  try {
    return { ctx: await makeTenantContext(user) }
  } catch (err) {
    const resp = tenancyErrorResponse(err)
    if (resp) return { error: resp }
    throw err
  }
}

export function tenantContextFromPosDevice(device: {
  orgId: string
  branchId: string | null
  deviceRowId: string
}): TenantContext {
  if (!device.orgId) throw new TenancyError(TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED)
  const allowedBranchIds = device.branchId ? [device.branchId] : []
  return {
    orgId: device.orgId,
    // Device row id is not a user — resolve actor per operation (e.g. order.salesperson_id).
    userId: '',
    defaultBranchId: device.branchId,
    allowedBranchIds,
    salesScopeOwn: false,
  }
}

function resolveEffectiveIdentity(sessionUser: AuthedSession['user']): {
  userId: string | null
  orgId: string | null
  branchId: string | null
  isRealSysAdmin: boolean
  isImpersonating: boolean
} {
  const isRealSysAdmin = sessionUser.realRole === 'sys-admin'
  const isImpersonating = !!sessionUser.impersonation
  const userId = sessionUser.impersonation?.userId ?? sessionUser.id ?? null
  const orgId = sessionUser.orgId ?? (isRealSysAdmin ? sessionUser.actingOrgId : null) ?? null
  const branchId = sessionUser.branchId ?? null
  return { userId, orgId, branchId, isRealSysAdmin, isImpersonating }
}

export async function makeTenantContext(sessionUser: AuthedSession['user']): Promise<TenantContext> {
  const { userId, orgId, branchId, isRealSysAdmin, isImpersonating } = resolveEffectiveIdentity(sessionUser)
  if (!orgId) {
    throw new TenancyError(TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED)
  }
  if (!userId) {
    throw new TenancyError(TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED)
  }

  // Sys-admin real without impersonation: allow all branches for org (branch filtering handled elsewhere).
  // For impersonated and normal users: restrict to user_branches.
  let allowedBranchIds: string[]
  if (isRealSysAdmin && !isImpersonating) {
    allowedBranchIds = []
  } else {
    // Lazy import: keeps unit tests isolated and works in Next runtime.
    const mod = await import('../modules/auth/user-branch.model')
    const UserBranch = mod.default
    const links = await UserBranch.findAll({
      where: { user_id: userId },
      attributes: ['branch_id'],
    })
    allowedBranchIds = links.map(l => l.branch_id)
    if (allowedBranchIds.length === 0 && branchId) allowedBranchIds = [branchId]
  }

  let salesScopeOwn = false
  if (!(isRealSysAdmin && !isImpersonating)) {
    const { getPermissionsForUser, hasSalesScopeOwn } = await import('@/lib/permissions')
    const perms = await getPermissionsForUser(
      { role: sessionUser.role, orgRoleId: sessionUser.orgRoleId },
      orgId,
    )
    salesScopeOwn = hasSalesScopeOwn(perms)
  }

  return {
    orgId,
    userId,
    defaultBranchId: branchId,
    allowedBranchIds,
    salesScopeOwn,
  }
}

export function whereOrg(ctx: TenantContext, where: Record<string, unknown> = {}) {
  return { ...where, org_id: ctx.orgId }
}

export function whereBranch(
  ctx: TenantContext,
  branchId: string,
  where: Record<string, unknown> = {},
) {
  if (!branchId) throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_REQUIRED)
  if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(branchId)) {
    throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
  }
  return { ...where, org_id: ctx.orgId, branch_id: branchId }
}

export function whereAllowedBranches(
  ctx: TenantContext,
  where: Record<string, unknown> = {},
) {
  if (ctx.allowedBranchIds.length === 0) return { ...where, org_id: ctx.orgId }
  return { ...where, org_id: ctx.orgId, branch_id: { [Op.in]: ctx.allowedBranchIds } }
}

/** Same branch scoping as `whereAllowedBranches`, but for queries on the `branches` table (PK is `id`). */
export function whereAllowedBranchRecords(
  ctx: TenantContext,
  where: Record<string, unknown> = {},
) {
  const { id: explicitId, ...rest } = where
  const scoped: Record<string, unknown> = { ...rest, org_id: ctx.orgId }

  if (typeof explicitId === 'string') {
    if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(explicitId)) {
      throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
    }
    scoped.id = explicitId
    return scoped
  }

  if (ctx.allowedBranchIds.length === 0) return scoped
  return { ...scoped, id: { [Op.in]: ctx.allowedBranchIds } }
}

