import type { UserRole } from '@/types/roles'

export type OrgUserIdentity = {
  id: string
  role: UserRole | string
  org_role_id?: string | null
}

/** Built-in org managers that should not edit peers from the org user list. */
export function orgUserManagementPeerKey(
  role: UserRole | string,
  orgRoleId: string | null | undefined,
): string | null {
  if (role === 'admin' && !orgRoleId) return 'builtin:admin'
  if (role === 'branch-admin' && !orgRoleId) return 'builtin:branch-admin'
  return null
}

export function canManageOrgUserFromList(actor: OrgUserIdentity, target: OrgUserIdentity): boolean {
  if (actor.id === target.id) return false
  const actorKey = orgUserManagementPeerKey(actor.role, actor.org_role_id)
  const targetKey = orgUserManagementPeerKey(target.role, target.org_role_id)
  if (actorKey !== null && actorKey === targetKey) return false
  return true
}
