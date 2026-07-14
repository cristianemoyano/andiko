import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE recurring_expense_frequency AS ENUM ('monthly', 'weekly');

    CREATE TABLE recurring_expense_templates (
      id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id             UUID          NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      contact_id            UUID          NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
      description           VARCHAR(500)  NOT NULL,
      expense_account_code  VARCHAR(20)   NOT NULL,
      default_amount        NUMERIC(15,2) NOT NULL CHECK (default_amount >= 0),
      iva_rate              VARCHAR(10)   NOT NULL DEFAULT '21',
      frequency             recurring_expense_frequency NOT NULL DEFAULT 'monthly',
      next_run_date         TIMESTAMPTZ   NOT NULL,
      is_active             BOOLEAN       NOT NULL DEFAULT true,
      created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at            TIMESTAMPTZ,
      created_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by            UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_recurring_expense_templates_org_branch
      ON recurring_expense_templates(org_id, branch_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_recurring_expense_templates_contact
      ON recurring_expense_templates(contact_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_recurring_expense_templates_due
      ON recurring_expense_templates(next_run_date) WHERE deleted_at IS NULL AND is_active = true;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_recurring_expense_templates_due;
    DROP INDEX IF EXISTS idx_recurring_expense_templates_contact;
    DROP INDEX IF EXISTS idx_recurring_expense_templates_org_branch;
    DROP TABLE IF EXISTS recurring_expense_templates;

    DROP TYPE IF EXISTS recurring_expense_frequency;
  `)
}
