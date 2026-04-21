import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS org_id    UUID REFERENCES organizations(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

    CREATE INDEX idx_users_org_id ON users(org_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_users_org_id;

    ALTER TABLE users
      DROP COLUMN IF EXISTS org_id,
      DROP COLUMN IF EXISTS branch_id;
  `)
}
