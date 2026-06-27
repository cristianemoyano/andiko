import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE usage_records (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID REFERENCES organizations(id) ON DELETE SET NULL,
      subscription_id UUID REFERENCES org_subscriptions(id) ON DELETE SET NULL,
      metric_key      VARCHAR(50) NOT NULL,
      quantity        NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      period          DATE NOT NULL,
      recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      invoiced_at     TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_usage_records_org ON usage_records(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_usage_records_subscription ON usage_records(subscription_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_usage_records_uninvoiced ON usage_records(subscription_id, period)
      WHERE deleted_at IS NULL AND invoiced_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS usage_records;
  `)
}
