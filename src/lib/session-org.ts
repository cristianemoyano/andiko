import 'server-only'
import { NextResponse } from 'next/server'
import type { UserRole } from '@/types/roles'
import { orgContextRequiredResponse } from '@/lib/tenancy'

/**
 * Effective org for mutations that require `org_id` (document sequences, tenancy).
 *
 * - Uses **effective** `orgId` (impersonated user’s org when applicable).
 * - Real `sys-admin` without `org_id` and not impersonating: `actingOrgId` (sidebar “Contexto ERP”).
 */
export async function resolveOrgIdForMutation(user: {
  orgId: string | null
  actingOrgId?: string | null
  role: UserRole
  realRole?: UserRole
}): Promise<string | null> {
  if (user.orgId) return user.orgId
  const isRealSysAdmin = (user.realRole ?? user.role) === 'sys-admin'
  if (isRealSysAdmin && user.actingOrgId) return user.actingOrgId
  return null
}

/** Resolves org scope for API routes; returns 422 response when org context is missing. */
export async function resolveOrgScope(user: {
  orgId: string | null
  actingOrgId?: string | null
  role: UserRole
  realRole?: UserRole
}): Promise<{ orgId: string } | { error: NextResponse }> {
  const orgId = await resolveOrgIdForMutation(user)
  if (!orgId) return { error: orgContextRequiredResponse() }
  return { orgId }
}
