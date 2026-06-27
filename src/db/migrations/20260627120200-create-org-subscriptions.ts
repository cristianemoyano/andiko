import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'paused', 'cancelled');

    CREATE TABLE org_subscriptions (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id               UUID REFERENCES organizations(id) ON DELETE SET NULL,
      plan_id              UUID NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
      status               subscription_status NOT NULL DEFAULT 'trialing',
      seats                INTEGER NOT NULL DEFAULT 1 CHECK (seats >= 1),
      billing_day          INTEGER NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
      current_period_start TIMESTAMPTZ,
      current_period_end   TIMESTAMPTZ,
      trial_end            TIMESTAMPTZ,
      started_at           TIMESTAMPTZ,
      cancelled_at         TIMESTAMPTZ,
      notes                TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at           TIMESTAMPTZ,
      created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by           UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by           UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_org_subscriptions_org ON org_subscriptions(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_org_subscriptions_plan ON org_subscriptions(plan_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_org_subscriptions_status ON org_subscriptions(status) WHERE deleted_at IS NULL;
    -- One non-cancelled subscription per organization
    CREATE UNIQUE INDEX idx_org_subscriptions_active_org ON org_subscriptions(org_id)
      WHERE deleted_at IS NULL AND status <> 'cancelled';

    CREATE TABLE subscription_addons (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID REFERENCES organizations(id) ON DELETE SET NULL,
      subscription_id UUID NOT NULL REFERENCES org_subscriptions(id) ON DELETE CASCADE,
      module_key      VARCHAR(40) NOT NULL,
      unit_price      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
      enabled         BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX idx_subscription_addons_unique ON subscription_addons(subscription_id, module_key) WHERE deleted_at IS NULL;
    CREATE INDEX idx_subscription_addons_sub ON subscription_addons(subscription_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS subscription_addons;
    DROP TABLE IF EXISTS org_subscriptions;
    DROP TYPE IF EXISTS subscription_status;
  `)
}
