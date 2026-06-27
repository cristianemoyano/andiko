import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE billing_plan_metric_allowances (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id             UUID REFERENCES organizations(id) ON DELETE SET NULL,
      plan_id            UUID NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
      metric_key         VARCHAR(50) NOT NULL,
      included_quantity  NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (included_quantity >= 0),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at         TIMESTAMPTZ,
      created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by         UUID REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT billing_plan_metric_allowances_metric_key_chk
        CHECK (metric_key ~ '^[a-z0-9_]+$')
    );

    CREATE UNIQUE INDEX idx_billing_plan_metric_allowances_unique
      ON billing_plan_metric_allowances(plan_id, metric_key)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_billing_plan_metric_allowances_plan
      ON billing_plan_metric_allowances(plan_id)
      WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS billing_plan_metric_allowances;
  `)
}
