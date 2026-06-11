import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE pos_cash_sessions (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id                UUID REFERENCES branches(id) ON DELETE SET NULL,
      pos_device_id            UUID REFERENCES pos_devices(id) ON DELETE SET NULL,
      local_id                 VARCHAR(64),
      cashier_user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
      cashier_name             VARCHAR(128),
      opened_at                TIMESTAMPTZ NOT NULL,
      closed_at                TIMESTAMPTZ,
      opening_amount           NUMERIC(15,2) NOT NULL DEFAULT 0,
      closing_amount_declared  NUMERIC(15,2),
      closing_amount_expected  NUMERIC(15,2),
      difference               NUMERIC(15,2),
      status                   VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      synced_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_pos_cash_sessions_local_id UNIQUE (org_id, local_id)
    );

    CREATE INDEX idx_pos_cash_sessions_org_id ON pos_cash_sessions (org_id);
    CREATE INDEX idx_pos_cash_sessions_branch_id ON pos_cash_sessions (branch_id);
    CREATE INDEX idx_pos_cash_sessions_opened_at ON pos_cash_sessions (org_id, opened_at DESC);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS pos_cash_sessions;`)
}
