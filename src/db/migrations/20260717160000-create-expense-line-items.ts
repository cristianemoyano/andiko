import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE expense_schedule_items (
      id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      schedule_id           UUID          NOT NULL REFERENCES expense_schedules(id) ON DELETE CASCADE,
      description           VARCHAR(500)  NOT NULL,
      quantity              NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_price            NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
      discount_pct          NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
      iva_rate              VARCHAR(10)   NOT NULL DEFAULT '21',
      expense_account_code  VARCHAR(20)   NOT NULL,
      subtotal              NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      discount_amount       NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_amount            NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      total                 NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
      sort_order            INTEGER       NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at            TIMESTAMPTZ,
      created_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by            UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_expense_schedule_items_schedule
      ON expense_schedule_items(schedule_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_expense_schedule_items_org
      ON expense_schedule_items(org_id) WHERE deleted_at IS NULL;

    CREATE TABLE expense_items (
      id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      expense_id            UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      description           VARCHAR(500)  NOT NULL,
      quantity              NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_price            NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
      discount_pct          NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
      iva_rate              VARCHAR(10)   NOT NULL DEFAULT '21',
      expense_account_code  VARCHAR(20)   NOT NULL,
      subtotal              NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      discount_amount       NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_amount            NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      total                 NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
      sort_order            INTEGER       NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at            TIMESTAMPTZ,
      created_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by            UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_expense_items_expense
      ON expense_items(expense_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_expense_items_org
      ON expense_items(org_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_expense_items_org;
    DROP INDEX IF EXISTS idx_expense_items_expense;
    DROP TABLE IF EXISTS expense_items;

    DROP INDEX IF EXISTS idx_expense_schedule_items_org;
    DROP INDEX IF EXISTS idx_expense_schedule_items_schedule;
    DROP TABLE IF EXISTS expense_schedule_items;
  `)
}
