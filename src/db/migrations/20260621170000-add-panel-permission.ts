import type { Migration } from '../../lib/migrations'

const PANEL_PERMISSION = {
  name: 'panel:read',
  description: 'Ver panel ejecutivo',
} as const

const DEFAULT_ROLES = ['admin', 'branch-admin'] as const

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(
    `INSERT INTO permissions (name, description)
     VALUES (:name, :description)
     ON CONFLICT (name) DO NOTHING`,
    { replacements: PANEL_PERMISSION },
  )

  for (const role of DEFAULT_ROLES) {
    await queryInterface.sequelize.query(
      `INSERT INTO role_permissions (role, permission_id)
       SELECT :role, id FROM permissions WHERE name = :name
       ON CONFLICT DO NOTHING`,
      { replacements: { role, name: PANEL_PERMISSION.name } },
    )
  }
}

export const down: Migration = async ({ context: queryInterface }) => {
  for (const role of DEFAULT_ROLES) {
    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions
       WHERE permission_id = (SELECT id FROM permissions WHERE name = :name)
         AND role = :role`,
      { replacements: { role, name: PANEL_PERMISSION.name } },
    )
  }

  await queryInterface.sequelize.query(
    `DELETE FROM permissions WHERE name = :name`,
    { replacements: { name: PANEL_PERMISSION.name } },
  )
}
