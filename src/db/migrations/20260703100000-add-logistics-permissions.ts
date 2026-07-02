import type { Migration } from '../../lib/migrations'

const LOGISTICS_PERMISSIONS = [
  { name: 'logistics:read', description: 'Logística · Leer' },
  { name: 'logistics:write', description: 'Logística · Escribir' },
  { name: 'logistics:delete', description: 'Logística · Eliminar' },
  { name: 'logistics:scope_assigned', description: 'Logística · Solo asignados' },
] as const

const BUILTIN_GRANTS: Record<string, string[]> = {
  admin: ['logistics:read', 'logistics:write', 'logistics:delete'],
  operator: ['logistics:read', 'logistics:write'],
  readonly: ['logistics:read'],
  'branch-admin': ['logistics:read', 'logistics:write'],
}

export const up: Migration = async ({ context: queryInterface }) => {
  for (const perm of LOGISTICS_PERMISSIONS) {
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

  // Mirror sales grants on custom org roles (Vendedor, Depósito, etc.).
  await queryInterface.sequelize.query(`
    INSERT INTO org_role_permissions (org_role_id, permission_id)
    SELECT DISTINCT orp.org_role_id, lp.id
    FROM org_role_permissions orp
    JOIN permissions sp ON sp.id = orp.permission_id
    JOIN permissions lp ON (
      (sp.name = 'sales:read' AND lp.name = 'logistics:read')
      OR (sp.name = 'sales:write' AND lp.name = 'logistics:write')
      OR (sp.name = 'sales:delete' AND lp.name = 'logistics:delete')
    )
    ON CONFLICT DO NOTHING
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  for (const perm of LOGISTICS_PERMISSIONS) {
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
