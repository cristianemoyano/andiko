import { Op, type Transaction } from 'sequelize'
import OrgRole from '@/modules/auth/org-role.model'
import OrgRolePermission from '@/modules/auth/org-role-permission.model'
import PermissionModel from '@/modules/auth/permission.model'
import { DEFAULT_ORG_ROLE_TEMPLATES } from '@/modules/auth/role-labels'

/** Seeds default custom org roles (Vendedor, Gerente de compras, etc.) if none exist. */
export async function seedDefaultOrgRoles(orgId: string, transaction?: Transaction) {
  const existing = await OrgRole.count({ where: { org_id: orgId }, transaction })
  if (existing > 0) return

  for (const template of DEFAULT_ORG_ROLE_TEMPLATES) {
    const role = await OrgRole.create(
      {
        org_id: orgId,
        name: template.name,
        description: template.description,
        allows_pos: template.allows_pos,
      },
      { transaction },
    )

    if (template.permissions.length === 0) continue

    const permRows = await PermissionModel.findAll({
      where: { name: { [Op.in]: template.permissions } },
      attributes: ['id', 'name'],
      transaction,
    })
    if (permRows.length !== template.permissions.length) {
      throw new Error('INVALID_PERMISSION')
    }
    await OrgRolePermission.bulkCreate(
      permRows.map(p => ({ org_role_id: role.id, permission_id: p.id })),
      { transaction },
    )
  }
}
