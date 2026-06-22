import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import User from '@/modules/auth/user.model'
import Branch from '@/modules/auth/branch.model'
import OrgRole from '@/modules/auth/org-role.model'
import UserBranch from '@/modules/auth/user-branch.model'
import { hashPassword } from '@/modules/auth/auth.service'
import { invalidateCapabilitiesIdentity } from '@/lib/capabilities-cache'
import { orgUserManagementPeerKey } from '@/lib/org-user-management-access'
import type { OrgUserMutationActor } from '@/lib/org-user-mutation-actor'
import type { OrgUserCreateInput, OrgUserUpdateInput } from '@/modules/auth/org-users.schema'
import { formatUserDisplayName, resolveUserNameParts } from '@/modules/auth/user.utils'
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

function assertBranchAdminSingleBranch(role: UserRole, branchIds: string[]) {
  if (role === 'branch-admin' && branchIds.length !== 1) {
    throw new Error('BRANCH_ADMIN_SINGLE_BRANCH')
  }
}

async function assertOrgRoleBelongsToOrg(orgId: string, orgRoleId: string) {
  const row = await OrgRole.findOne({ where: { id: orgRoleId, org_id: orgId }, paranoid: true })
  if (!row) throw new Error('ORG_ROLE_NOT_FOUND')
  return row
}

async function countActiveBuiltinAdmins(orgId: string, excludeUserId?: string) {
  return User.count({
    where: {
      org_id: orgId,
      role: 'admin',
      org_role_id: null,
      is_active: true,
      ...(excludeUserId ? { id: { [Op.ne]: excludeUserId } } : {}),
    },
    paranoid: true,
  })
}

async function assertActorCanMutateOrgUser(
  orgId: string,
  targetUserId: string,
  actor?: OrgUserMutationActor,
) {
  const target = await User.findOne({
    where: { id: targetUserId, org_id: orgId },
    paranoid: true,
    attributes: ['id', 'role', 'org_role_id'],
  })
  if (!target) throw new Error('USER_NOT_IN_ORG')
  if ((target.role as UserRole) === 'sys-admin') throw new Error('USER_NOT_EDITABLE')

  if (!actor?.userId || actor.bypassManagementRules) return target

  if (actor.userId === targetUserId) throw new Error('CANNOT_EDIT_SELF')

  const actorUser = await User.findOne({
    where: { id: actor.userId, org_id: orgId },
    paranoid: true,
    attributes: ['id', 'role', 'org_role_id'],
  })
  if (!actorUser) throw new Error('ACTOR_NOT_IN_ORG')

  const actorKey = orgUserManagementPeerKey(actorUser.role as UserRole, actorUser.org_role_id)
  const targetKey = orgUserManagementPeerKey(target.role as UserRole, target.org_role_id)
  if (actorKey !== null && actorKey === targetKey) throw new Error('CANNOT_EDIT_PEER')

  return target
}

export async function listOrgUsers(orgId: string) {
  const users = await User.findAll({
    where: { org_id: orgId, role: { [Op.ne]: 'sys-admin' } },
    attributes: [
      'id', 'email', 'name', 'first_name', 'last_name', 'role', 'org_role_id', 'is_active', 'branch_id', 'created_at', 'updated_at',
    ],
    order: [['email', 'ASC']],
  })
  const ids = users.map(u => u.id)
  if (ids.length === 0) return []

  const roleIds = [...new Set(users.map(u => u.org_role_id).filter((id): id is string => !!id))]
  const roleMap = new Map<string, string>()
  if (roleIds.length > 0) {
    const roles = await OrgRole.findAll({
      where: { id: { [Op.in]: roleIds } },
      attributes: ['id', 'name'],
    })
    for (const r of roles) roleMap.set(r.id, r.name)
  }

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

  return users.map(u => {
    const fromJunction = map.get(u.id) ?? []
    const branch_ids =
      fromJunction.length > 0 ? fromJunction : u.branch_id ? [u.branch_id] : []
    return {
      id: u.id,
      email: u.email,
      name: formatUserDisplayName(u.first_name, u.last_name) || u.name,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role as UserRole,
      org_role_id: u.org_role_id,
      org_role_name: u.org_role_id ? roleMap.get(u.org_role_id) ?? null : null,
      is_active: u.is_active,
      default_branch_id: u.branch_id,
      branch_ids,
      created_at: u.created_at.toISOString(),
      updated_at: u.updated_at.toISOString(),
    }
  })
}

export async function createOrgUser(orgId: string, input: OrgUserCreateInput) {
  const branchIds = [...new Set(input.branchIds)]
  await assertBranchesBelongToOrg(orgId, branchIds)

  let role: UserRole
  let org_role_id: string | null = null

  if (input.roleKind === 'custom') {
    await assertOrgRoleBelongsToOrg(orgId, input.orgRoleId)
    role = 'operator'
    org_role_id = input.orgRoleId
  } else {
    role = input.role
    assertBranchAdminSingleBranch(role, branchIds)
  }

  const emailTaken = await User.findOne({
    where: { email: input.email.trim().toLowerCase() },
    paranoid: true,
    attributes: ['id'],
  })
  if (emailTaken) throw new Error('EMAIL_TAKEN')

  const password_hash = await hashPassword(input.password)
  const pos_pin_hash = input.posPin ? await hashPassword(input.posPin) : null
  const { firstName, lastName, displayName } = resolveUserNameParts(input)

  const user = await sequelize.transaction(async t => {
    const created = await User.create(
      {
        email: input.email.trim().toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        name: displayName,
        password_hash,
        pos_pin_hash,
        role,
        org_role_id,
        org_id: orgId,
        branch_id: input.defaultBranchId,
        is_active: true,
      },
      { transaction: t },
    )

    await UserBranch.bulkCreate(
      branchIds.map(branch_id => ({ user_id: created.id, branch_id })),
      { transaction: t },
    )

    return created
  })

  invalidateCapabilitiesIdentity(orgId, role, org_role_id)
  return user
}

export async function updateOrgUser(
  orgId: string,
  userId: string,
  input: OrgUserUpdateInput,
  actor?: OrgUserMutationActor,
) {
  const user = await assertActorCanMutateOrgUser(orgId, userId, actor)
  await user.reload()

  const previousRole = user.role as UserRole
  const previousOrgRoleId = user.org_role_id

  const nextBranchIds =
    input.branchIds !== undefined ? [...new Set(input.branchIds)] : undefined
  if (nextBranchIds) {
    await assertBranchesBelongToOrg(orgId, nextBranchIds)
  }

  const effectiveRole =
    input.roleKind === 'builtin' && input.role !== undefined
      ? input.role
      : (user.role as UserRole)

  if (nextBranchIds) {
    assertBranchAdminSingleBranch(effectiveRole, nextBranchIds)
  } else if (input.roleKind === 'builtin' && input.role === 'branch-admin') {
    const currentIds = (
      await UserBranch.findAll({ where: { user_id: userId }, attributes: ['branch_id'] })
    ).map(r => r.branch_id)
    const allowed = currentIds.length > 0 ? currentIds : user.branch_id ? [user.branch_id] : []
    assertBranchAdminSingleBranch('branch-admin', allowed)
  }

  if (input.is_active === false || input.roleKind === 'builtin') {
    const wasBuiltinAdmin = user.role === 'admin' && !user.org_role_id
    const willRemainAdmin =
      input.roleKind === 'custom'
        ? false
        : input.roleKind === 'builtin' && input.role !== undefined
          ? input.role === 'admin'
          : wasBuiltinAdmin

    if (wasBuiltinAdmin && !willRemainAdmin && input.is_active !== false) {
      const others = await countActiveBuiltinAdmins(orgId, userId)
      if (others === 0) throw new Error('LAST_ADMIN')
    }
    if (wasBuiltinAdmin && input.is_active === false) {
      const others = await countActiveBuiltinAdmins(orgId, userId)
      if (others === 0) throw new Error('LAST_ADMIN')
    }
  }

  if (nextBranchIds && input.defaultBranchId !== undefined) {
    if (!nextBranchIds.includes(input.defaultBranchId)) {
      throw new Error('DEFAULT_BRANCH_INVALID')
    }
  }

  const updated = await sequelize.transaction(async t => {
    const patch: Partial<{
      name: string
      first_name: string
      last_name: string
      role: UserRole
      org_role_id: string | null
      branch_id: string | null
      password_hash: string
      pos_pin_hash: string | null
      is_active: boolean
    }> = {}

    if (input.firstName !== undefined) {
      const lastName = input.lastName ?? user.last_name
      const displayName = formatUserDisplayName(input.firstName, lastName)
      patch.first_name = input.firstName.trim()
      patch.last_name = lastName.trim()
      patch.name = displayName
    } else if (input.lastName !== undefined) {
      const displayName = formatUserDisplayName(user.first_name, input.lastName)
      patch.last_name = input.lastName.trim()
      patch.name = displayName
    }
    if (input.is_active !== undefined) patch.is_active = input.is_active
    if (input.password !== undefined) patch.password_hash = await hashPassword(input.password)
    if (input.posPin !== undefined) patch.pos_pin_hash = input.posPin ? await hashPassword(input.posPin) : null

    if (input.roleKind === 'custom') {
      await assertOrgRoleBelongsToOrg(orgId, input.orgRoleId)
      patch.role = 'operator'
      patch.org_role_id = input.orgRoleId
    } else if (input.roleKind === 'builtin' && input.role !== undefined) {
      patch.role = input.role
      patch.org_role_id = null
    }

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
      await UserBranch.destroy({ where: { user_id: userId }, transaction: t })
      await UserBranch.bulkCreate(
        nextBranchIds.map(branch_id => ({ user_id: userId, branch_id })),
        { transaction: t },
      )
    } else if (input.defaultBranchId !== undefined) {
      const currentIds = (
        await UserBranch.findAll({
          where: { user_id: userId },
          attributes: ['branch_id'],
          transaction: t,
        })
      ).map(r => r.branch_id)
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

  const identityChanged =
    input.is_active === false
    || input.roleKind === 'custom'
    || (input.roleKind === 'builtin' && input.role !== undefined)

  if (identityChanged) {
    invalidateCapabilitiesIdentity(orgId, previousRole, previousOrgRoleId)
    invalidateCapabilitiesIdentity(orgId, updated.role as UserRole, updated.org_role_id)
  }

  return updated
}

export async function softDeleteOrgUser(
  orgId: string,
  userId: string,
  actor?: OrgUserMutationActor,
) {
  const user = await assertActorCanMutateOrgUser(orgId, userId, actor)
  await user.reload()

  if (user.role === 'admin' && !user.org_role_id) {
    const others = await countActiveBuiltinAdmins(orgId, userId)
    if (others === 0) throw new Error('LAST_ADMIN')
  }

  await sequelize.transaction(async t => {
    await UserBranch.destroy({ where: { user_id: userId }, transaction: t })
    await user.destroy({ transaction: t })
  })

  invalidateCapabilitiesIdentity(orgId, user.role as UserRole, user.org_role_id)
}

export async function deleteBranchWithGuard(orgId: string, branchId: string) {
  const branch = await Branch.findOne({ where: { id: branchId, org_id: orgId }, paranoid: true })
  if (!branch) throw new Error('BRANCH_NOT_FOUND')

  const activeCount = await Branch.count({ where: { org_id: orgId, is_active: true } })
  if (branch.is_active && activeCount <= 1) throw new Error('LAST_BRANCH')

  await branch.destroy()
}
