import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import OrgRole from '@/modules/auth/org-role.model'
import OrgRolePermission from '@/modules/auth/org-role-permission.model'
import PermissionModel from '@/modules/auth/permission.model'
import User from '@/modules/auth/user.model'
import {
  ASSIGNABLE_MATRIX_PERMISSIONS,
  getPermissionsForRole,
  isModulePermission,
  isPanelPermission,
  isLogisticsScopePermission,
  isSalesScopePermission,
  isSettingsPermission,
  type MatrixPermission,
} from '@/lib/permissions'
import type { OrgRoleCreateInput, OrgRoleUpdateInput, OrgRoleMatrixUpdateInput } from '@/modules/auth/org-roles.schema'
import { invalidateCapabilitiesForOrg } from '@/lib/capabilities-cache'
import {
  BUILTIN_MATRIX_ROLES,
  BUILTIN_ROLE_LABEL,
} from '@/modules/auth/role-labels'
import { seedDefaultOrgRoles } from '@/modules/auth/org-roles-seed'

export { seedDefaultOrgRoles }

import { permissionDisplayLabel, permissionDescription } from '@/lib/permission-labels'

function permissionGroup(name: MatrixPermission): string {
  return isPanelPermission(name) ? 'panel' : name.split(':')[0]
}

function isMatrixPermission(name: string): name is MatrixPermission {
  return isModulePermission(name) || isPanelPermission(name) || isSalesScopePermission(name) || isLogisticsScopePermission(name)
}

async function assertAssignablePermissions(permissionNames: string[]) {
  for (const name of permissionNames) {
    if (isSettingsPermission(name)) throw new Error('SETTINGS_PERMISSION_NOT_ASSIGNABLE')
    if (!isMatrixPermission(name) || !ASSIGNABLE_MATRIX_PERMISSIONS.includes(name)) {
      throw new Error('INVALID_PERMISSION')
    }
  }
}

export async function listOrgRolesMatrix(orgId: string) {
  const customRoles = await OrgRole.findAll({
    where: { org_id: orgId },
    order: [['name', 'ASC']],
    attributes: ['id', 'name', 'allows_pos'],
  })

  const customIds = customRoles.map(r => r.id)
  const userCounts = new Map<string, number>()
  if (customIds.length > 0) {
    const rows = await User.findAll({
      where: { org_id: orgId, org_role_id: { [Op.in]: customIds } },
      attributes: ['org_role_id'],
    })
    for (const r of rows) {
      if (r.org_role_id) userCounts.set(r.org_role_id, (userCounts.get(r.org_role_id) ?? 0) + 1)
    }
  }

  const customGrants = new Map<string, MatrixPermission[]>()
  if (customIds.length > 0) {
    const links = await OrgRolePermission.findAll({
      where: { org_role_id: { [Op.in]: customIds } },
      include: [{ model: PermissionModel, as: 'permission', attributes: ['name'] }],
    })
    for (const id of customIds) customGrants.set(id, [])
    for (const link of links) {
      const name = (link as unknown as { permission: { name: string } }).permission?.name
      if (isMatrixPermission(name)) {
        const arr = customGrants.get(link.org_role_id) ?? []
        arr.push(name)
        customGrants.set(link.org_role_id, arr)
      }
    }
  }

  const builtinGrants: Record<string, MatrixPermission[]> = {}
  for (const role of BUILTIN_MATRIX_ROLES) {
    const perms = await getPermissionsForRole(role, orgId)
    builtinGrants[role] = perms.filter(isMatrixPermission)
  }

  const grants: Record<string, MatrixPermission[]> = { ...builtinGrants }
  for (const [id, perms] of customGrants) grants[id] = perms

  return {
    permissions: ASSIGNABLE_MATRIX_PERMISSIONS.map(name => ({
      name,
      label: permissionDisplayLabel(name),
      description: permissionDescription(name),
      group: permissionGroup(name as MatrixPermission),
    })),
    columns: [
      ...BUILTIN_MATRIX_ROLES.map(role => ({
        kind: 'builtin' as const,
        role,
        label: BUILTIN_ROLE_LABEL[role] ?? role,
        readonly: true,
      })),
      ...customRoles.map(r => ({
        kind: 'custom' as const,
        id: r.id,
        name: r.name,
        allows_pos: r.allows_pos,
        user_count: userCounts.get(r.id) ?? 0,
        readonly: false,
      })),
    ],
    grants,
  }
}

export async function createOrgRole(orgId: string, input: OrgRoleCreateInput) {
  const name = input.name.trim()
  const taken = await OrgRole.findOne({
    where: { org_id: orgId, name: { [Op.iLike]: name } },
    paranoid: true,
  })
  if (taken) throw new Error('ORG_ROLE_NAME_TAKEN')

  const role = await OrgRole.create({
    org_id: orgId,
    name,
    description: input.description?.trim() || null,
    allows_pos: input.allows_pos ?? false,
  })
  invalidateCapabilitiesForOrg(orgId)
  return role
}

export async function updateOrgRole(orgId: string, roleId: string, input: OrgRoleUpdateInput) {
  const role = await OrgRole.findOne({ where: { id: roleId, org_id: orgId }, paranoid: true })
  if (!role) throw new Error('ORG_ROLE_NOT_FOUND')

  const patch: Partial<{ name: string; description: string | null; allows_pos: boolean }> = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    const taken = await OrgRole.findOne({
      where: { org_id: orgId, name: { [Op.iLike]: name }, id: { [Op.ne]: roleId } },
      paranoid: true,
    })
    if (taken) throw new Error('ORG_ROLE_NAME_TAKEN')
    patch.name = name
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null
  if (input.allows_pos !== undefined) patch.allows_pos = input.allows_pos

  await role.update(patch)
  invalidateCapabilitiesForOrg(orgId)
  return role.reload()
}

export async function deleteOrgRole(orgId: string, roleId: string) {
  const role = await OrgRole.findOne({ where: { id: roleId, org_id: orgId }, paranoid: true })
  if (!role) throw new Error('ORG_ROLE_NOT_FOUND')

  const inUse = await User.count({
    where: { org_id: orgId, org_role_id: roleId },
  })
  if (inUse > 0) throw new Error('ORG_ROLE_IN_USE')

  await sequelize.transaction(async t => {
    await OrgRolePermission.destroy({ where: { org_role_id: roleId }, transaction: t })
    await role.destroy({ transaction: t })
  })
  invalidateCapabilitiesForOrg(orgId)
}

export async function updateOrgRolesMatrix(orgId: string, input: OrgRoleMatrixUpdateInput) {
  for (const update of input.updates) {
    const role = await OrgRole.findOne({
      where: { id: update.orgRoleId, org_id: orgId },
      paranoid: true,
    })
    if (!role) throw new Error('ORG_ROLE_NOT_FOUND')

    await assertAssignablePermissions(update.permissionNames)

    await sequelize.transaction(async t => {
      await OrgRolePermission.destroy({ where: { org_role_id: role.id }, transaction: t })

      if (update.permissionNames.length > 0) {
        const permRows = await PermissionModel.findAll({
          where: { name: { [Op.in]: update.permissionNames } },
          attributes: ['id', 'name'],
          transaction: t,
        })
        if (permRows.length !== update.permissionNames.length) {
          throw new Error('INVALID_PERMISSION')
        }
        await OrgRolePermission.bulkCreate(
          permRows.map(p => ({ org_role_id: role.id, permission_id: p.id })),
          { transaction: t },
        )
      }
    })
  }

  invalidateCapabilitiesForOrg(orgId)
  return listOrgRolesMatrix(orgId)
}
