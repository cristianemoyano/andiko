import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE warehouses (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id   UUID        REFERENCES branches(id) ON DELETE SET NULL,
      name        VARCHAR(255) NOT NULL,
      description TEXT,
      is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_warehouses_name_org UNIQUE (name, org_id)
    );

    CREATE INDEX idx_warehouses_org        ON warehouses(org_id)       WHERE deleted_at IS NULL;
    CREATE INDEX idx_warehouses_branch     ON warehouses(branch_id)    WHERE deleted_at IS NULL AND branch_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_warehouses_branch;
    DROP INDEX IF EXISTS idx_warehouses_org;
    DROP TABLE IF EXISTS warehouses;
  `)
}
