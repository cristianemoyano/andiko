import type { Migration } from '../../lib/migrations'

const PRODUCTION_PERMISSIONS = [
  { name: 'production:read', description: 'Producción · Leer' },
  { name: 'production:write', description: 'Producción · Escribir' },
  { name: 'production:delete', description: 'Producción · Eliminar' },
] as const

const BUILTIN_GRANTS: Record<string, string[]> = {
  admin: ['production:read', 'production:write', 'production:delete'],
  'branch-admin': ['production:read', 'production:write', 'production:delete'],
  operator: ['production:read', 'production:write'],
  readonly: ['production:read'],
}

export const up: Migration = async ({ context: queryInterface }) => {
  for (const perm of PRODUCTION_PERMISSIONS) {
    await queryInterface.sequelize.query(
      `INSERT INTO permissions (name, description)
       VALUES (:name, :description)
       ON CONFLICT (name) DO NOTHING`,
      { replacements: perm },
    )
  }

  for (const [role, names] of Object.entries(BUILTIN_GRANTS)) {
    for (const name of names) {
      await queryInterface.sequelize.query(
        `INSERT INTO role_permissions (role, permission_id)
         SELECT :role, id FROM permissions WHERE name = :name
         ON CONFLICT DO NOTHING`,
        { replacements: { role, name } },
      )
    }
  }
}

export const down: Migration = async ({ context: queryInterface }) => {
  for (const perm of PRODUCTION_PERMISSIONS) {
    await queryInterface.sequelize.query(
      `DELETE FROM role_permissions
       WHERE permission_id = (SELECT id FROM permissions WHERE name = :name)`,
      { replacements: { name: perm.name } },
    )
    await queryInterface.sequelize.query(
      `DELETE FROM permissions WHERE name = :name`,
      { replacements: { name: perm.name } },
    )
  }
}
