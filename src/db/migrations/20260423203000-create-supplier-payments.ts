import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE supplier_payments (
      id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id         UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id      UUID          REFERENCES branches(id) ON DELETE SET NULL,
      invoice_id     UUID          NOT NULL REFERENCES supplier_invoices(id) ON DELETE RESTRICT,
      contact_id     UUID          REFERENCES contacts(id) ON DELETE SET NULL,
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
      CONSTRAINT uq_supplier_payments_number_org UNIQUE (payment_number, org_id)
    );

    CREATE INDEX idx_supplier_payments_org     ON supplier_payments(org_id)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_supplier_payments_branch  ON supplier_payments(branch_id)  WHERE deleted_at IS NULL AND branch_id IS NOT NULL;
    CREATE INDEX idx_supplier_payments_invoice ON supplier_payments(invoice_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_supplier_payments_contact ON supplier_payments(contact_id) WHERE deleted_at IS NULL AND contact_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_supplier_payments_contact;
    DROP INDEX IF EXISTS idx_supplier_payments_invoice;
    DROP INDEX IF EXISTS idx_supplier_payments_branch;
    DROP INDEX IF EXISTS idx_supplier_payments_org;
    DROP TABLE IF EXISTS supplier_payments;
  `)
}
