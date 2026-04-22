import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import User from '@/modules/auth/user.model'
import Branch from '@/modules/auth/branch.model'
import UserBranch from '@/modules/auth/user-branch.model'
import { hashPassword } from '@/modules/auth/auth.service'
import type { OrgUserCreateInput, OrgUserUpdateInput } from '@/modules/auth/org-users.schema'
import type { UserRole } from '@/types/roles'

async function assertBranchesBelongToOrg(orgId: string, branchIds: string[]) {
  if (branchIds.length === 0) return
  const rows = await Branch.findAll({
    where: {
      id: { [Op.in]: branchIds },
      org_id: orgId,
      is_active: true,
    },
    attributes: ['id'],
  })
  if (rows.length !== branchIds.length) {
    throw new Error('BRANCH_NOT_IN_ORG')
  }
}

export async function listOrgUsers(orgId: string) {
  const users = await User.findAll({
    where: { org_id: orgId, role: { [Op.ne]: 'sys-admin' } },
    attributes: ['id', 'email', 'name', 'role', 'is_active', 'branch_id', 'created_at', 'updated_at'],
    order: [['email', 'ASC']],
  })
  const ids = users.map((u) => u.id)
  if (ids.length === 0) return []

  const links = await UserBranch.findAll({
    where: { user_id: { [Op.in]: ids } },
    attributes: ['user_id', 'branch_id'],
  })
  const map = new Map<string, string[]>()
  for (const l of links) {
    const arr = map.get(l.user_id) ?? []
    arr.push(l.branch_id)
    map.set(l.user_id, arr)
  }

  return users.map((u) => {
    const fromJunction = map.get(u.id) ?? []
    const branch_ids =
      fromJunction.length > 0 ? fromJunction : u.branch_id ? [u.branch_id] : []
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserRole,
      is_active: u.is_active,
      default_branch_id: u.branch_id,
      branch_ids,
      created_at: u.created_at.toISOString(),
      updated_at: u.updated_at.toISOString(),
    }
  })
}

export async function createOrgUser(orgId: string, input: OrgUserCreateInput) {
  await assertBranchesBelongToOrg(orgId, [...new Set(input.branchIds)])

  const emailTaken = await User.findOne({
    where: { email: input.email.trim().toLowerCase() },
    paranoid: true,
    attributes: ['id'],
  })
  if (emailTaken) throw new Error('EMAIL_TAKEN')

  const password_hash = await hashPassword(input.password)

  return sequelize.transaction(async (t) => {
    const user = await User.create(
      {
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        password_hash,
        role: input.role,
        org_id: orgId,
        branch_id: input.defaultBranchId,
        is_active: true,
      },
      { transaction: t },
    )

    const uniqueBranchIds = [...new Set(input.branchIds)]
    await UserBranch.bulkCreate(
      uniqueBranchIds.map((branch_id) => ({
        user_id: user.id,
        branch_id,
      })),
      { transaction: t },
    )

    return user
  })
}

export async function updateOrgUser(orgId: string, userId: string, input: OrgUserUpdateInput) {
  const user = await User.findOne({
    where: { id: userId, org_id: orgId },
    paranoid: true,
  })
  if (!user) throw new Error('USER_NOT_IN_ORG')
  if ((user.role as UserRole) === 'sys-admin') {
    throw new Error('USER_NOT_EDITABLE')
  }

  const nextBranchIds =
    input.branchIds !== undefined ? [...new Set(input.branchIds)] : undefined
  if (nextBranchIds) {
    await assertBranchesBelongToOrg(orgId, nextBranchIds)
  }

  if (nextBranchIds && input.defaultBranchId !== undefined) {
    if (!nextBranchIds.includes(input.defaultBranchId)) {
      throw new Error('DEFAULT_BRANCH_INVALID')
    }
  }

  return sequelize.transaction(async (t) => {
    const patch: Partial<{
      name: string
      role: 'admin' | 'operator' | 'readonly'
      branch_id: string | null
      password_hash: string
      is_active: boolean
    }> = {}

    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.role !== undefined) patch.role = input.role
    if (input.is_active !== undefined) patch.is_active = input.is_active
    if (input.password !== undefined) patch.password_hash = await hashPassword(input.password)

    if (nextBranchIds) {
      let newDefault: string | null
      if (input.defaultBranchId !== undefined) {
        newDefault = input.defaultBranchId
      } else if (user.branch_id && nextBranchIds.includes(user.branch_id)) {
        newDefault = user.branch_id
      } else {
        newDefault = nextBranchIds[0] ?? null
      }
      patch.branch_id = newDefault
      await UserBranch.destroy({
        where: { user_id: userId },
        transaction: t,
      })
      await UserBranch.bulkCreate(
        [...new Set(nextBranchIds)].map((branch_id) => ({ user_id: userId, branch_id })),
        { transaction: t },
      )
    } else if (input.defaultBranchId !== undefined) {
      const currentIds = (
        await UserBranch.findAll({
          where: { user_id: userId },
          attributes: ['branch_id'],
          transaction: t,
        })
      ).map((r) => r.branch_id)
      const allowed =
        currentIds.length > 0 ? currentIds : user.branch_id ? [user.branch_id] : []
      if (!allowed.includes(input.defaultBranchId)) {
        throw new Error('DEFAULT_BRANCH_INVALID')
      }
      patch.branch_id = input.defaultBranchId
    }

    if (Object.keys(patch).length > 0) {
      await user.update(patch, { transaction: t })
    }

    return user.reload({ transaction: t })
  })
}

export async function softDeleteOrgUser(orgId: string, userId: string) {
  const user = await User.findOne({
    where: { id: userId, org_id: orgId },
    paranoid: true,
  })
  if (!user) throw new Error('USER_NOT_IN_ORG')
  if ((user.role as UserRole) === 'sys-admin') {
    throw new Error('USER_NOT_EDITABLE')
  }

  return sequelize.transaction(async (t) => {
    await UserBranch.destroy({ where: { user_id: userId }, transaction: t })
    await user.destroy({ transaction: t })
  })
}
