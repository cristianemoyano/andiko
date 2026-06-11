import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'check', 'card', 'other');

    CREATE TABLE payments (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id         UUID REFERENCES organizations(id) ON DELETE SET NULL,
      branch_id      UUID REFERENCES branches(id) ON DELETE SET NULL,
      invoice_id     UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
      contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
      payment_number VARCHAR(20) NOT NULL,
      payment_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      amount         NUMERIC(15,2) NOT NULL CHECK (amount > 0),
      payment_method payment_method NOT NULL,
      reference      VARCHAR(255),
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at     TIMESTAMPTZ,
      created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (payment_number, org_id)
    );

    CREATE INDEX idx_payments_org_id     ON payments(org_id)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_payments_invoice_id ON payments(invoice_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_payments_contact_id ON payments(contact_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS payments;
    DROP TYPE IF EXISTS payment_method;
  `)
}
