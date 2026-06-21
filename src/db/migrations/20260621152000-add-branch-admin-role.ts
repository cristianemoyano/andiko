import type { Migration } from '../../lib/migrations'

const BRANCH_ADMIN_DEFAULTS = [
  'contacts:read', 'contacts:write',
  'products:read', 'products:write',
  'sales:read', 'sales:write',
  'inventory:read', 'inventory:write',
  'purchases:read', 'purchases:write',
  'accounting:read',
] as const

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'branch-admin';
  `)

  for (const permName of BRANCH_ADMIN_DEFAULTS) {
    await queryInterface.sequelize.query(
      `INSERT INTO role_permissions (role, permission_id)
       SELECT 'branch-admin', id FROM permissions WHERE name = :name
       ON CONFLICT DO NOTHING`,
      { replacements: { name: permName } },
    )
  }
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DELETE FROM role_permissions
    WHERE role = 'branch-admin';
  `)

  await queryInterface.sequelize.query(`
    UPDATE users SET role = 'operator' WHERE role = 'branch-admin';
  `)

  // PostgreSQL does not support removing enum values easily — leave branch-admin in enum on down.
}
