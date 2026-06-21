import { Op, type Transaction } from 'sequelize'
import OrgRole from '@/modules/auth/org-role.model'
import OrgRolePermission from '@/modules/auth/org-role-permission.model'
import PermissionModel from '@/modules/auth/permission.model'
import { DEFAULT_ORG_ROLE_TEMPLATES, type DefaultOrgRoleTemplate } from '@/modules/auth/role-labels'

async function createOrgRoleFromTemplate(
  orgId: string,
  template: DefaultOrgRoleTemplate,
  transaction?: Transaction,
) {
  const role = await OrgRole.create(
    {
      org_id: orgId,
      name: template.name,
      description: template.description,
      allows_pos: template.allows_pos,
    },
    { transaction },
  )

  if (template.permissions.length === 0) return role

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
  return role
}

/** Seeds default custom org roles (Vendedor, Cajero, Gerente de compras, etc.) if none exist. */
export async function seedDefaultOrgRoles(orgId: string, transaction?: Transaction) {
  const existing = await OrgRole.count({ where: { org_id: orgId }, transaction })
  if (existing > 0) return

  for (const template of DEFAULT_ORG_ROLE_TEMPLATES) {
    await createOrgRoleFromTemplate(orgId, template, transaction)
  }
}

/** Adds missing default org role templates by name (for migrations after new templates ship). */
export async function ensureOrgRoleTemplates(
  orgId: string,
  templateNames: string[],
  transaction?: Transaction,
) {
  for (const name of templateNames) {
    const template = DEFAULT_ORG_ROLE_TEMPLATES.find(t => t.name === name)
    if (!template) continue

    const existing = await OrgRole.findOne({
      where: { org_id: orgId, name: template.name },
      transaction,
      paranoid: true,
    })
    if (existing) continue

    await createOrgRoleFromTemplate(orgId, template, transaction)
  }
}
