import { Op } from 'sequelize'

const POS_BUILTIN_ROLES = ['admin', 'branch-admin'] as const

export function buildPosCashierUserWhere(
  orgId: string,
  posOrgRoleIds: string[],
  branchId?: string | null,
) {
  const where: Record<string, unknown> & Record<symbol, unknown> = {
    org_id: orgId,
    is_active: true,
    deleted_at: null,
    [Op.or]: [
      { role: { [Op.in]: [...POS_BUILTIN_ROLES] } },
      ...(posOrgRoleIds.length > 0 ? [{ org_role_id: { [Op.in]: posOrgRoleIds } }] : []),
    ],
  }

  if (branchId) {
    where.branch_id = { [Op.or]: [branchId, null] }
  }

  return where
}
