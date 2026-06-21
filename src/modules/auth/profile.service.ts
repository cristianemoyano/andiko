import 'server-only'
import { Op } from 'sequelize'
import User from '@/modules/auth/user.model'
import Branch from '@/modules/auth/branch.model'
import OrgRole from '@/modules/auth/org-role.model'
import Organization from '@/modules/auth/organization.model'
import UserBranch from '@/modules/auth/user-branch.model'
import { hashPassword, validatePassword } from '@/modules/auth/auth.service'
import { getBuiltinRoleLabel } from '@/modules/auth/role-labels'
import type { ProfileUpdateInput } from '@/modules/auth/profile.schema'
import type { UserRole } from '@/types/roles'

export type ProfileView = {
  id: string
  name: string
  email: string
  role: UserRole
  roleLabel: string
  orgId: string | null
  orgName: string | null
  branchId: string | null
  branchLabel: string
}

export type ProfileUpdateContext = {
  actorRealRole: UserRole
  isImpersonating: boolean
}

export async function getUserProfile(userId: string): Promise<ProfileView | null> {
  const user = await User.findOne({
    where: { id: userId, is_active: true },
    attributes: ['id', 'email', 'name', 'role', 'org_id', 'branch_id', 'org_role_id'],
    paranoid: true,
  })
  if (!user) return null

  let roleLabel = getBuiltinRoleLabel(user.role as UserRole)
  if (user.org_role_id) {
    const orgRole = await OrgRole.findByPk(user.org_role_id, { attributes: ['name'], paranoid: true })
    if (orgRole?.name) roleLabel = orgRole.name
  }

  let orgName: string | null = null
  if (user.org_id) {
    const org = await Organization.findByPk(user.org_id, { attributes: ['name'], paranoid: true })
    orgName = org?.name ?? null
  }

  const branchLabel = await resolveBranchLabel(user.id, user.org_id, user.branch_id)

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    roleLabel,
    orgId: user.org_id,
    orgName,
    branchId: user.branch_id,
    branchLabel,
  }
}

async function resolveBranchLabel(
  userId: string,
  orgId: string | null,
  defaultBranchId: string | null,
): Promise<string> {
  if (!orgId) return 'Sin organización asignada'

  const links = await UserBranch.findAll({
    where: { user_id: userId },
    attributes: ['branch_id'],
  })
  const branchIds = links.map(l => l.branch_id)
  if (branchIds.length === 0 && defaultBranchId) branchIds.push(defaultBranchId)

  if (branchIds.length === 0) return 'Acceso a todas las sucursales'

  const branches = await Branch.findAll({
    where: { id: { [Op.in]: branchIds }, org_id: orgId },
    attributes: ['name'],
    order: [['name', 'ASC']],
  })
  if (branches.length === 0) return 'Acceso a todas las sucursales'
  return branches.map(b => b.name).join(', ')
}

export async function updateUserProfile(
  userId: string,
  input: ProfileUpdateInput,
  ctx: ProfileUpdateContext,
): Promise<ProfileView> {
  const user = await User.findOne({
    where: { id: userId, is_active: true },
    attributes: ['id', 'password_hash', 'role'],
    paranoid: true,
  })
  if (!user) throw new Error('NOT_FOUND')

  const patch: { name?: string; password_hash?: string } = {}

  if (input.name !== undefined) {
    patch.name = input.name
  }

  if (input.password !== undefined) {
    const adminOverride = ctx.actorRealRole === 'sys-admin' && ctx.isImpersonating
    if (!adminOverride) {
      if (!input.currentPassword) throw new Error('CURRENT_PASSWORD_REQUIRED')
      const valid = await validatePassword(input.currentPassword, user.password_hash)
      if (!valid) throw new Error('CURRENT_PASSWORD_INVALID')
    }
    patch.password_hash = await hashPassword(input.password)
  }

  if (Object.keys(patch).length === 0) throw new Error('NO_CHANGES')

  await user.update(patch)

  const profile = await getUserProfile(userId)
  if (!profile) throw new Error('NOT_FOUND')
  return profile
}
