import type { Migration } from '../../lib/migrations'

const SCOPE_PERMISSION = {
  name: 'sales:scope_own',
  description: 'Ventas · Solo propias',
} as const

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(
    `INSERT INTO permissions (name, description)
     VALUES (:name, :description)
     ON CONFLICT (name) DO NOTHING`,
    { replacements: SCOPE_PERMISSION },
  )

  await queryInterface.sequelize.query(
    `INSERT INTO org_role_permissions (org_role_id, permission_id)
     SELECT r.id, p.id
     FROM org_roles r
     CROSS JOIN permissions p
     WHERE r.name = 'Vendedor'
       AND r.deleted_at IS NULL
       AND p.name = :name
     ON CONFLICT DO NOTHING`,
    { replacements: { name: SCOPE_PERMISSION.name } },
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(
    `DELETE FROM org_role_permissions
     WHERE permission_id = (SELECT id FROM permissions WHERE name = :name)`,
    { replacements: { name: SCOPE_PERMISSION.name } },
  )

  await queryInterface.sequelize.query(
    `DELETE FROM permissions WHERE name = :name`,
    { replacements: { name: SCOPE_PERMISSION.name } },
  )
}
