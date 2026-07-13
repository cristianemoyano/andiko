import type { Migration } from '../../lib/migrations'

const AUTOMATIONS_PERMISSIONS = [
  { name: 'automations:read', description: 'Automatizaciones · Leer' },
  { name: 'automations:write', description: 'Automatizaciones · Escribir' },
  { name: 'automations:delete', description: 'Automatizaciones · Eliminar' },
] as const

const BUILTIN_GRANTS: Record<string, string[]> = {
  admin: ['automations:read', 'automations:write', 'automations:delete'],
  operator: ['automations:read', 'automations:write'],
  readonly: ['automations:read'],
  'branch-admin': ['automations:read', 'automations:write'],
}

export const up: Migration = async ({ context: queryInterface }) => {
  for (const perm of AUTOMATIONS_PERMISSIONS) {
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

  // Mirror admin's automations grants on custom org roles that already have sales:write
  // (automations is a premium, admin-adjacent capability; org owners opt custom roles in later).
  await queryInterface.sequelize.query(`
    INSERT INTO org_role_permissions (org_role_id, permission_id)
    SELECT DISTINCT orp.org_role_id, ap.id
    FROM org_role_permissions orp
    JOIN permissions sp ON sp.id = orp.permission_id
    JOIN permissions ap ON (
      (sp.name = 'sales:write' AND ap.name = 'automations:read')
    )
    ON CONFLICT DO NOTHING
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  for (const perm of AUTOMATIONS_PERMISSIONS) {
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
