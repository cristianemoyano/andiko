import 'server-only'
import { Op } from 'sequelize'
import { can } from '@/lib/permissions'
import type { TenantContext } from '@/lib/tenancy'
import type { UserRole } from '@/types/roles'
import FileLink from './file-link.model'
import FileShare, { type SharePermission } from './file-share.model'
import { OWNER_RESOLVERS } from './owner-registry'

export type AccessMode = 'read' | 'write'

/** Everything the ReBAC check needs about the caller (more than TenantContext: role + org role). */
export interface FileActor {
  ctx: TenantContext
  role: UserRole
  orgRoleId: string | null
}

/** A write grant satisfies a read request; a read grant does not satisfy a write request. */
function grantSatisfies(grant: SharePermission, mode: AccessMode): boolean {
  return grant === 'write' || grant === mode
}

function shareMatchesActor(
  share: { principal_type: string; principal_id: string },
  actor: FileActor,
): boolean {
  switch (share.principal_type) {
    case 'user':
      return share.principal_id === actor.ctx.userId
    case 'org_role':
      return actor.orgRoleId !== null && share.principal_id === actor.orgRoleId
    case 'branch':
      return actor.ctx.allowedBranchIds.includes(share.principal_id)
    default:
      return false
  }
}

export function buildExplicitSharePrincipalWhere(actor: FileActor) {
  const ors: Array<Record<string, unknown>> = [
    { principal_type: 'user', principal_id: actor.ctx.userId },
  ]
  if (actor.orgRoleId) {
    ors.push({ principal_type: 'org_role', principal_id: actor.orgRoleId })
  }
  if (actor.ctx.allowedBranchIds.length > 0) {
    ors.push({
      principal_type: 'branch',
      principal_id: { [Op.in]: actor.ctx.allowedBranchIds },
    })
  }
  return { [Op.or]: ors }
}

const UNEXPIRED_SHARE = {
  [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }],
} as const

export const unexpiredShareWhere = UNEXPIRED_SHARE

/** True when an explicit, unexpired share grants the actor `mode` on the file. */
async function hasExplicitShare(fileId: string, actor: FileActor, mode: AccessMode): Promise<boolean> {
  const shares = await FileShare.findAll({
    where: {
      file_id: fileId,
      ...UNEXPIRED_SHARE,
    },
    attributes: ['principal_type', 'principal_id', 'permission'],
  })

  return shares.some((share) => {
    if (!grantSatisfies(share.permission, mode)) return false
    return shareMatchesActor(share, actor)
  })
}

/**
 * True when the actor can `mode` at least one record the file is linked to: they hold the
 * owner module's permission AND the owner record is visible in their tenant/branch scope.
 */
async function hasInheritedAccess(fileId: string, actor: FileActor, mode: AccessMode): Promise<boolean> {
  const links = await FileLink.findAll({
    where: { file_id: fileId },
    attributes: ['owner_type', 'owner_id'],
  })

  for (const link of links) {
    const resolver = OWNER_RESOLVERS[link.owner_type]
    if (!resolver) continue
    const permission = mode === 'write' ? resolver.writePermission : resolver.readPermission
    if (!(await can(actor.role, permission, actor.ctx.orgId, actor.orgRoleId))) continue
    if (await resolver.exists(link.owner_id, actor.ctx)) return true
  }
  return false
}

/**
 * ReBAC decision for a file the caller has already loaded within their org scope.
 * Access is granted when ANY holds: org/sys admin, creator, an explicit share, or inherited
 * access from a linked record. Standalone files (no links) fall back to admin/creator/share.
 */
export async function canAccessFile(
  file: { created_by: string | null },
  actor: FileActor,
  mode: AccessMode,
  fileId: string,
): Promise<boolean> {
  if (actor.role === 'sys-admin' || actor.role === 'admin') return true
  if (file.created_by && file.created_by === actor.ctx.userId) return true
  if (await hasExplicitShare(fileId, actor, mode)) return true
  if (await hasInheritedAccess(fileId, actor, mode)) return true
  return false
}
