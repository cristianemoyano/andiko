import 'server-only'
import type { Transaction } from 'sequelize'
import User from '@/modules/auth/user.model'
import Branch from '@/modules/auth/branch.model'

export async function countActiveUsers(orgId: string, t?: Transaction): Promise<number> {
  return User.count({
    where: { org_id: orgId, is_active: true },
    paranoid: true,
    transaction: t,
  })
}

export async function countActiveBranches(orgId: string, t?: Transaction): Promise<number> {
  return Branch.count({
    where: { org_id: orgId, is_active: true },
    paranoid: true,
    transaction: t,
  })
}
