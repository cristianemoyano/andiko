import type { Migration } from '../../lib/migrations'

const HR_PERMISSIONS = [
  { name: 'employees:read', description: 'RRHH · Empleados · Leer' },
  { name: 'employees:write', description: 'RRHH · Empleados · Escribir' },
  { name: 'employees:delete', description: 'RRHH · Empleados · Eliminar' },
  { name: 'attendance:read', description: 'RRHH · Control de horario · Leer' },
  { name: 'attendance:write', description: 'RRHH · Control de horario · Escribir' },
  { name: 'attendance:delete', description: 'RRHH · Control de horario · Eliminar' },
  { name: 'attendance:scope_own', description: 'RRHH · Control de horario · Solo propio' },
] as const

const BUILTIN_GRANTS: Record<string, string[]> = {
  admin: ['employees:read', 'employees:write', 'employees:delete', 'attendance:read', 'attendance:write', 'attendance:delete'],
  'branch-admin': ['employees:read', 'employees:write', 'attendance:read', 'attendance:write', 'attendance:delete'],
  operator: ['attendance:read', 'attendance:write', 'attendance:scope_own'],
  readonly: ['employees:read', 'attendance:read'],
}

// Unlike logistics/sales-scope-own, HR permissions are intentionally NOT auto-mirrored into
// org_role_permissions for custom roles — there is no safe analogous existing permission to
// mirror from (employees:*/attendance:* expose employee PII, so silently granting it to any
// custom role via a heuristic would be worse than requiring an explicit grant). Orgs using
// custom roles must grant employees:*/attendance:* explicitly via the roles-matrix UI.

export const up: Migration = async ({ context: queryInterface }) => {
  for (const perm of HR_PERMISSIONS) {
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
  for (const perm of HR_PERMISSIONS) {
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
