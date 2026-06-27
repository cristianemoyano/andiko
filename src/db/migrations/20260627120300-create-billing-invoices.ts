import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE billing_invoice_status AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'void');
    CREATE TYPE billing_line_kind AS ENUM ('base', 'seat', 'module_addon', 'usage', 'discount', 'adjustment');

    -- Global document-number sequences for platform billing (not org/branch scoped)
    CREATE TABLE billing_sequences (
      document_type VARCHAR(20) PRIMARY KEY,
      last_number   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE billing_invoices (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID REFERENCES organizations(id) ON DELETE SET NULL,
      subscription_id UUID REFERENCES org_subscriptions(id) ON DELETE SET NULL,
      invoice_number  VARCHAR(30) NOT NULL,
      status          billing_invoice_status NOT NULL DEFAULT 'draft',
      period_start    TIMESTAMPTZ,
      period_end      TIMESTAMPTZ,
      issue_date      TIMESTAMPTZ,
      due_date        TIMESTAMPTZ,
      currency        VARCHAR(3) NOT NULL DEFAULT 'ARS',
      subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      tax_amount      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      total           NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
      paid_amount     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      balance         NUMERIC(15,2) NOT NULL DEFAULT 0,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX idx_billing_invoices_number ON billing_invoices(invoice_number) WHERE deleted_at IS NULL;
    CREATE INDEX idx_billing_invoices_org ON billing_invoices(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_billing_invoices_subscription ON billing_invoices(subscription_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_billing_invoices_status ON billing_invoices(status) WHERE deleted_at IS NULL;
    CREATE INDEX idx_billing_invoices_due_date ON billing_invoices(due_date)
      WHERE deleted_at IS NULL AND status NOT IN ('paid', 'void');

    CREATE TABLE billing_invoice_items (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
      invoice_id  UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
      kind        billing_line_kind NOT NULL,
      description VARCHAR(500) NOT NULL,
      quantity    NUMERIC(15,4) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
      unit_price  NUMERIC(15,2) NOT NULL DEFAULT 0,
      iva_rate    iva_rate NOT NULL DEFAULT '21',
      subtotal    NUMERIC(15,2) NOT NULL DEFAULT 0,
      tax_base    NUMERIC(15,2) NOT NULL DEFAULT 0,
      tax_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
      total       NUMERIC(15,2) NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_billing_invoice_items_invoice ON billing_invoice_items(invoice_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS billing_invoice_items;
    DROP TABLE IF EXISTS billing_invoices;
    DROP TABLE IF EXISTS billing_sequences;
    DROP TYPE IF EXISTS billing_line_kind;
    DROP TYPE IF EXISTS billing_invoice_status;
  `)
}
