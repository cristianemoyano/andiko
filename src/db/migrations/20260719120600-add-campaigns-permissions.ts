import type { Migration } from '../../lib/migrations'

const CAMPAIGNS_PERMISSIONS = [
  { name: 'campaigns:read', description: 'Campañas · Leer' },
  { name: 'campaigns:write', description: 'Campañas · Escribir' },
  { name: 'campaigns:delete', description: 'Campañas · Eliminar' },
] as const

const BUILTIN_GRANTS: Record<string, string[]> = {
  admin: ['campaigns:read', 'campaigns:write', 'campaigns:delete'],
  operator: ['campaigns:read', 'campaigns:write'],
  readonly: ['campaigns:read'],
  'branch-admin': ['campaigns:read', 'campaigns:write'],
}

export const up: Migration = async ({ context: queryInterface }) => {
  for (const perm of CAMPAIGNS_PERMISSIONS) {
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

  // Mirror admin's campaigns grants on custom org roles that already have sales:write
  // (campaigns is a sales-adjacent capability; org owners opt custom roles in later).
  await queryInterface.sequelize.query(`
    INSERT INTO org_role_permissions (org_role_id, permission_id)
    SELECT DISTINCT orp.org_role_id, cp.id
    FROM org_role_permissions orp
    JOIN permissions pp ON pp.id = orp.permission_id
    JOIN permissions cp ON (
      (pp.name = 'sales:write' AND cp.name = 'campaigns:read')
    )
    ON CONFLICT DO NOTHING
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  for (const perm of CAMPAIGNS_PERMISSIONS) {
    await queryInterface.sequelize.query(
      `DELETE FROM org_role_permissions
       WHERE permission_id = (SELECT id FROM permissions WHERE name = :name)`,
      { replacements: { name: perm.name } },
    )
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
