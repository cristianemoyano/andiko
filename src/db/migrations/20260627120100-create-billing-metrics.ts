import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE billing_metrics (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
      key        VARCHAR(50) NOT NULL,
      label      VARCHAR(255) NOT NULL,
      unit_label VARCHAR(50),
      unit_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
      is_active  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX idx_billing_metrics_key ON billing_metrics(key) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS billing_metrics;
  `)
}
