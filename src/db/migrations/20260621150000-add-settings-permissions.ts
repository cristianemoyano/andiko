import type { Migration } from '../../lib/migrations'

const SETTINGS_PERMISSIONS = [
  { name: 'settings:read', description: 'Read organization settings' },
  { name: 'settings:write', description: 'Write organization settings' },
] as const

export const up: Migration = async ({ context: queryInterface }) => {
  for (const p of SETTINGS_PERMISSIONS) {
    await queryInterface.sequelize.query(
      `INSERT INTO permissions (name, description)
       VALUES (:name, :description)
       ON CONFLICT (name) DO NOTHING`,
      { replacements: p },
    )
  }

  for (const permName of SETTINGS_PERMISSIONS.map(p => p.name)) {
    await queryInterface.sequelize.query(
      `INSERT INTO role_permissions (role, permission_id)
       SELECT 'admin', id FROM permissions WHERE name = :name
       ON CONFLICT DO NOTHING`,
      { replacements: { name: permName } },
    )
  }
}

export const down: Migration = async ({ context: queryInterface }) => {
  for (const permName of SETTINGS_PERMISSIONS.map(p => p.name)) {
    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions
       WHERE permission_id = (SELECT id FROM permissions WHERE name = :name)
         AND role = 'admin'`,
      { replacements: { name: permName } },
    )
  }

  for (const permName of SETTINGS_PERMISSIONS.map(p => p.name)) {
    await queryInterface.sequelize.query(
      `DELETE FROM permissions WHERE name = :name`,
      { replacements: { name: permName } },
    )
  }
}
