import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE pos_payment_methods (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name            VARCHAR(128) NOT NULL,
      type            VARCHAR(64)  NOT NULL,
      requires_reference BOOLEAN NOT NULL DEFAULT FALSE,
      config          JSONB NOT NULL DEFAULT '{}',
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order      SMALLINT NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      CONSTRAINT uq_pos_payment_methods_org_name UNIQUE (org_id, name)
    );

    CREATE INDEX idx_pos_payment_methods_org_id
      ON pos_payment_methods (org_id)
      WHERE deleted_at IS NULL;

    CREATE TABLE pos_branch_payment_methods (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id               UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      pos_payment_method_id   UUID NOT NULL REFERENCES pos_payment_methods(id) ON DELETE CASCADE,
      is_active               BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order              SMALLINT NOT NULL DEFAULT 0,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_pos_branch_payment_methods UNIQUE (branch_id, pos_payment_method_id)
    );

    CREATE INDEX idx_pos_branch_pm_branch_id
      ON pos_branch_payment_methods (branch_id);
    CREATE INDEX idx_pos_branch_pm_org_id
      ON pos_branch_payment_methods (org_id);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS pos_branch_payment_methods;
    DROP TABLE IF EXISTS pos_payment_methods;
  `)
}
