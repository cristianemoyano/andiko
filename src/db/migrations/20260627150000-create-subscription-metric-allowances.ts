import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE subscription_metric_allowances (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                  UUID REFERENCES organizations(id) ON DELETE SET NULL,
      subscription_id         UUID NOT NULL REFERENCES org_subscriptions(id) ON DELETE CASCADE,
      metric_key              VARCHAR(50) NOT NULL,
      extra_included_quantity NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (extra_included_quantity >= 0),
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at              TIMESTAMPTZ,
      created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by              UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by              UUID REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT subscription_metric_allowances_metric_key_chk
        CHECK (metric_key ~ '^[a-z0-9_]+$')
    );

    CREATE UNIQUE INDEX idx_subscription_metric_allowances_unique
      ON subscription_metric_allowances(subscription_id, metric_key)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_subscription_metric_allowances_subscription
      ON subscription_metric_allowances(subscription_id)
      WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS subscription_metric_allowances;
  `)
}
