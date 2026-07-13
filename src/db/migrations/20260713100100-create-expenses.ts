import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE expense_status AS ENUM (
      'draft', 'received', 'partially_paid', 'paid', 'cancelled'
    );

    CREATE TABLE expenses (
      id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                 UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id              UUID          NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      contact_id             UUID          NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
      recurring_template_id  UUID          REFERENCES recurring_expense_templates(id) ON DELETE SET NULL,
      buyer_id               UUID          REFERENCES users(id) ON DELETE SET NULL,
      expense_number         VARCHAR(20)   NOT NULL,
      description            VARCHAR(500)  NOT NULL,
      expense_account_code   VARCHAR(20)   NOT NULL,
      invoice_number         VARCHAR(50),
      status                 expense_status NOT NULL DEFAULT 'draft',
      invoice_date           TIMESTAMPTZ,
      due_date               TIMESTAMPTZ,
      currency               VARCHAR(3)    NOT NULL DEFAULT 'ARS',
      subtotal               NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      discount_amount        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_amount             NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      total                  NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
      paid_amount            NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      balance                NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
      notes                  TEXT,
      created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at             TIMESTAMPTZ,
      created_by             UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by             UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by             UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_expenses_number_org UNIQUE (expense_number, org_id)
    );

    CREATE INDEX idx_expenses_org_branch ON expenses(org_id, branch_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_expenses_contact    ON expenses(contact_id)        WHERE deleted_at IS NULL;
    CREATE INDEX idx_expenses_template   ON expenses(recurring_template_id) WHERE deleted_at IS NULL AND recurring_template_id IS NOT NULL;
    CREATE INDEX idx_expenses_status     ON expenses(status)            WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_expenses_status;
    DROP INDEX IF EXISTS idx_expenses_template;
    DROP INDEX IF EXISTS idx_expenses_contact;
    DROP INDEX IF EXISTS idx_expenses_org_branch;
    DROP TABLE IF EXISTS expenses;

    DROP TYPE IF EXISTS expense_status;
  `)
}
