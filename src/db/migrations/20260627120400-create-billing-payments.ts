import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE billing_payment_method AS ENUM ('cash', 'transfer', 'check', 'card', 'other');

    CREATE TABLE billing_payments (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id         UUID REFERENCES organizations(id) ON DELETE SET NULL,
      invoice_id     UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE RESTRICT,
      payment_number VARCHAR(30) NOT NULL,
      payment_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      amount         NUMERIC(15,2) NOT NULL CHECK (amount > 0),
      payment_method billing_payment_method NOT NULL,
      reference      VARCHAR(255),
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at     TIMESTAMPTZ,
      created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by     UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX idx_billing_payments_number ON billing_payments(payment_number) WHERE deleted_at IS NULL;
    CREATE INDEX idx_billing_payments_invoice ON billing_payments(invoice_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_billing_payments_org ON billing_payments(org_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS billing_payments;
    DROP TYPE IF EXISTS billing_payment_method;
  `)
}
