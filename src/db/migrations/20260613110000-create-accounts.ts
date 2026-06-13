import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');

    CREATE TABLE accounts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      parent_id   UUID REFERENCES accounts(id) ON DELETE SET NULL,
      code        VARCHAR(20) NOT NULL,
      name        VARCHAR(120) NOT NULL,
      type        account_type NOT NULL,
      is_postable BOOLEAN NOT NULL DEFAULT TRUE,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX uq_accounts_code_org ON accounts(code, org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_accounts_org_id    ON accounts(org_id)    WHERE deleted_at IS NULL;
    CREATE INDEX idx_accounts_parent_id ON accounts(parent_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS accounts;
    DROP TYPE IF EXISTS account_type;
  `)
}
