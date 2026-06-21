import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE org_roles (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID NOT NULL REFERENCES organizations(id),
      name        VARCHAR(100) NOT NULL,
      description VARCHAR(255),
      allows_pos  BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX uq_org_roles_org_name ON org_roles(org_id, lower(name)) WHERE deleted_at IS NULL;
    CREATE INDEX idx_org_roles_org_id ON org_roles(org_id) WHERE deleted_at IS NULL;

    CREATE TABLE org_role_permissions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_role_id     UUID NOT NULL REFERENCES org_roles(id) ON DELETE CASCADE,
      permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_org_role_permission UNIQUE (org_role_id, permission_id)
    );

    CREATE INDEX idx_org_role_permissions_role ON org_role_permissions(org_role_id);

    ALTER TABLE users ADD COLUMN IF NOT EXISTS org_role_id UUID REFERENCES org_roles(id);
    CREATE INDEX IF NOT EXISTS idx_users_org_role_id ON users(org_role_id);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS org_role_id;
    DROP TABLE IF EXISTS org_role_permissions;
    DROP TABLE IF EXISTS org_roles;
  `)
}
