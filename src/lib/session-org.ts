import 'server-only'
import type { UserRole } from '@/types/roles'

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
