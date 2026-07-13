import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE expense_payments (
      id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id         UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id      UUID          REFERENCES branches(id) ON DELETE SET NULL,
      expense_id     UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      contact_id     UUID          REFERENCES contacts(id) ON DELETE SET NULL,
      buyer_id       UUID          REFERENCES users(id) ON DELETE SET NULL,
      payment_number VARCHAR(20)   NOT NULL,
      payment_date   TIMESTAMPTZ   NOT NULL,
      amount         NUMERIC(15,2) NOT NULL CHECK (amount > 0),
      payment_method VARCHAR(50)   NOT NULL DEFAULT 'transfer',
      notes          TEXT,
      created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at     TIMESTAMPTZ,
      created_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_expense_payments_number_org UNIQUE (payment_number, org_id)
    );

    CREATE INDEX idx_expense_payments_org      ON expense_payments(org_id)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_expense_payments_expense  ON expense_payments(expense_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_expense_payments_contact  ON expense_payments(contact_id) WHERE deleted_at IS NULL AND contact_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_expense_payments_contact;
    DROP INDEX IF EXISTS idx_expense_payments_expense;
    DROP INDEX IF EXISTS idx_expense_payments_org;
    DROP TABLE IF EXISTS expense_payments;
  `)
}
