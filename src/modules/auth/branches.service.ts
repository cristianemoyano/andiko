import 'server-only'
import { Op } from 'sequelize'
import Branch from '@/modules/auth/branch.model'
import User from '@/modules/auth/user.model'
import UserBranch from '@/modules/auth/user-branch.model'

export async function listActiveBranchesForOrg(orgId: string) {
  return Branch.findAll({
    where: { org_id: orgId, is_active: true },
    order: [['branch_code', 'ASC'], ['name', 'ASC']],
    attributes: [
      'id', 'org_id', 'name', 'branch_code', 'address',
      'street', 'number', 'floor', 'apartment', 'city', 'province', 'postal_code', 'country',
      'is_active',
    ],
  })
}

/**
 * Active branches available to a user inside an org.
 *
 * - Prefers `user_branches` junction.
 * - Backwards compatible: if user has no junction rows, uses `users.branch_id` (legacy default).
 */
export async function listActiveBranchesForUser(orgId: string, userId: string) {
  const links = await UserBranch.findAll({
    where: { user_id: userId },
    attributes: ['branch_id'],
  })
  let branchIds = links.map(l => l.branch_id)

  if (branchIds.length === 0) {
    const user = await User.findOne({
      where: { id: userId, org_id: orgId },
      attributes: ['branch_id'],
      paranoid: true,
    })
    if (user?.branch_id) branchIds = [user.branch_id]
  }

  if (branchIds.length === 0) return []

  return Branch.findAll({
    where: {
      org_id: orgId,
      is_active: true,
      id: { [Op.in]: branchIds },
    },
    order: [['branch_code', 'ASC'], ['name', 'ASC']],
    attributes: [
      'id', 'org_id', 'name', 'branch_code', 'address',
      'street', 'number', 'floor', 'apartment', 'city', 'province', 'postal_code', 'country',
      'is_active',
    ],
  })
}
