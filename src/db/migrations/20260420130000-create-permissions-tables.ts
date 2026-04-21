import type { Migration } from '../../lib/migrations'

const RESOURCES = ['contacts', 'products', 'sales', 'inventory', 'purchases', 'accounting'] as const
const ACTIONS   = ['read', 'write', 'delete'] as const

const PERMISSIONS: Array<{ name: string; description: string }> = RESOURCES.flatMap(r =>
  ACTIONS.map(a => ({
    name:        `${r}:${a}`,
    description: `${a.charAt(0).toUpperCase() + a.slice(1)} ${r}`,
  }))
)

// Defaults: admin gets everything, operator gets read+write (no delete, no accounting:write),
// readonly gets read only.
function defaultsFor(role: 'admin' | 'operator' | 'readonly'): string[] {
  return PERMISSIONS
    .map(p => p.name)
    .filter(name => {
      if (role === 'admin')    return true
      if (role === 'readonly') return name.endsWith(':read')
      // operator: read + write, except accounting:write
      return name.endsWith(':read') ||
        (name.endsWith(':write') && name !== 'accounting:write')
    })
}

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE permissions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL UNIQUE,
      description VARCHAR(255),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE role_permissions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role          user_role NOT NULL,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_role_permission_org
        UNIQUE NULLS NOT DISTINCT (role, permission_id, org_id)
    );

    CREATE INDEX idx_role_permissions_role ON role_permissions(role);
    CREATE INDEX idx_role_permissions_org_id ON role_permissions(org_id);
  `)

  // Seed permissions catalog
  for (const p of PERMISSIONS) {
    await queryInterface.sequelize.query(
      `INSERT INTO permissions (name, description) VALUES (:name, :description)`,
      { replacements: p }
    )
  }

  // Seed role defaults (org_id = NULL → global default)
  for (const role of ['admin', 'operator', 'readonly'] as const) {
    for (const permName of defaultsFor(role)) {
      await queryInterface.sequelize.query(
        `INSERT INTO role_permissions (role, permission_id)
         SELECT :role, id FROM permissions WHERE name = :name`,
        { replacements: { role, name: permName } }
      )
    }
  }
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS role_permissions;
    DROP TABLE IF EXISTS permissions;
  `)
}
