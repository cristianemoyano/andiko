import 'server-only'
import { Op, type WhereOptions } from 'sequelize'
import OrgRole from '@/modules/auth/org-role.model'
import { resolveUserRoleLabel } from '@/modules/auth/role-labels'
import User from '@/modules/auth/user.model'
import UserBranch from '@/modules/auth/user-branch.model'
import type { UserRole } from '@/types/roles'

const POS_BUILTIN_ROLES = ['admin', 'branch-admin'] as const

export { buildPosCashierUserWhere } from '@/lib/pos-cashier-eligibility'

export async function getPosEligibleOrgRoleIds(orgId: string): Promise<string[]> {
  const roles = await OrgRole.findAll({
    where: { org_id: orgId, allows_pos: true },
    attributes: ['id'],
    paranoid: true,
  })
  return roles.map(r => r.id)
}

export type ListPosCashierUsersFilters = {
  q?: string
  since?: Date | null
  limit?: number
}

export type PosCashierUserDto = {
  id: string
  name: string
  email: string
  role: UserRole
  role_label: string
  branch_id: string | null
  updated_at: Date
  pos_pin_hash: string | null
}

/** Users who may open a POS cash shift for this org (and optional device branch). */
export async function listPosCashierUsers(
  orgId: string,
  branchId: string | null | undefined,
  filters: ListPosCashierUsersFilters = {},
) {
  const posOrgRoleIds = await getPosEligibleOrgRoleIds(orgId)
  const limit = filters.limit ?? 50

  const andClauses: WhereOptions[] = [
    {
      [Op.or]: [
        { role: { [Op.in]: [...POS_BUILTIN_ROLES] } },
        ...(posOrgRoleIds.length > 0 ? [{ org_role_id: { [Op.in]: posOrgRoleIds } }] : []),
      ],
    },
  ]

  if (branchId) {
    const branchRows = await UserBranch.findAll({
      where: { branch_id: branchId },
      attributes: ['user_id'],
    })
    const branchUserIds = branchRows.map(r => r.user_id)
    andClauses.push({
      [Op.or]: [
        { branch_id: branchId },
        { branch_id: null },
        ...(branchUserIds.length > 0 ? [{ id: { [Op.in]: branchUserIds } }] : []),
      ],
    })
  }

  const q = filters.q?.trim()
  if (q) {
    andClauses.push({
      [Op.or]: [
        { name: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ],
    })
  }

  const where: WhereOptions = {
    org_id: orgId,
    is_active: true,
    deleted_at: null,
    [Op.and]: andClauses,
  }

  if (filters.since) {
    where.updated_at = { [Op.gt]: filters.since }
  }

  const rows = await User.findAll({
    where,
    attributes: ['id', 'name', 'email', 'role', 'org_role_id', 'branch_id', 'updated_at', 'pos_pin_hash'],
    order: [['name', 'ASC']],
    limit,
  })

  const roleIds = [...new Set(rows.map(r => r.org_role_id).filter((id): id is string => !!id))]
  const roleMap = new Map<string, string>()
  if (roleIds.length > 0) {
    const orgRoles = await OrgRole.findAll({
      where: { id: { [Op.in]: roleIds } },
      attributes: ['id', 'name'],
      paranoid: true,
    })
    for (const role of orgRoles) roleMap.set(role.id, role.name)
  }

  return rows.map((u): PosCashierUserDto => {
    const orgRoleName = u.org_role_id ? roleMap.get(u.org_role_id) ?? null : null
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      role_label: resolveUserRoleLabel(u.role, orgRoleName),
      branch_id: u.branch_id,
      updated_at: u.updated_at as Date,
      pos_pin_hash: u.pos_pin_hash,
    }
  })
}
