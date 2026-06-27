import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE billing_interval AS ENUM ('monthly', 'annual');

    CREATE TABLE billing_plans (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id         UUID REFERENCES organizations(id) ON DELETE SET NULL,
      code           VARCHAR(50) NOT NULL,
      name           VARCHAR(255) NOT NULL,
      description    TEXT,
      currency       VARCHAR(3) NOT NULL DEFAULT 'ARS',
      interval       billing_interval NOT NULL DEFAULT 'monthly',
      base_price     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
      included_seats INTEGER NOT NULL DEFAULT 0 CHECK (included_seats >= 0),
      per_seat_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (per_seat_price >= 0),
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at     TIMESTAMPTZ,
      created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by     UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX idx_billing_plans_code ON billing_plans(code) WHERE deleted_at IS NULL;
    CREATE INDEX idx_billing_plans_active ON billing_plans(is_active) WHERE deleted_at IS NULL;

    CREATE TABLE billing_plan_modules (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
      plan_id     UUID NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
      module_key  VARCHAR(40) NOT NULL,
      included    BOOLEAN NOT NULL DEFAULT FALSE,
      addon_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (addon_price >= 0),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX idx_billing_plan_modules_unique ON billing_plan_modules(plan_id, module_key) WHERE deleted_at IS NULL;
    CREATE INDEX idx_billing_plan_modules_plan ON billing_plan_modules(plan_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS billing_plan_modules;
    DROP TABLE IF EXISTS billing_plans;
    DROP TYPE IF EXISTS billing_interval;
  `)
}
