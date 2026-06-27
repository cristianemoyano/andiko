import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE billing_plan_extras (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
      plan_id     UUID NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
      extra_key   VARCHAR(40) NOT NULL,
      included    BOOLEAN NOT NULL DEFAULT FALSE,
      addon_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (addon_price >= 0),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX idx_billing_plan_extras_unique ON billing_plan_extras(plan_id, extra_key) WHERE deleted_at IS NULL;
    CREATE INDEX idx_billing_plan_extras_plan ON billing_plan_extras(plan_id) WHERE deleted_at IS NULL;

    CREATE TABLE subscription_extras (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID REFERENCES organizations(id) ON DELETE SET NULL,
      subscription_id UUID NOT NULL REFERENCES org_subscriptions(id) ON DELETE CASCADE,
      extra_key       VARCHAR(40) NOT NULL,
      unit_price      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
      enabled         BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX idx_subscription_extras_unique ON subscription_extras(subscription_id, extra_key) WHERE deleted_at IS NULL;
    CREATE INDEX idx_subscription_extras_sub ON subscription_extras(subscription_id) WHERE deleted_at IS NULL;

    ALTER TYPE billing_line_kind ADD VALUE IF NOT EXISTS 'extra_addon';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS subscription_extras;
    DROP TABLE IF EXISTS billing_plan_extras;
  `)
}
