import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE supplier_invoice_status AS ENUM (
      'draft', 'received', 'partially_paid', 'paid', 'cancelled'
    );

    CREATE TABLE supplier_invoices (
      id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                  UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id               UUID          REFERENCES branches(id) ON DELETE SET NULL,
      contact_id              UUID          REFERENCES contacts(id) ON DELETE SET NULL,
      order_id                UUID          REFERENCES purchase_orders(id) ON DELETE SET NULL,
      receipt_id              UUID          REFERENCES purchase_receipts(id) ON DELETE SET NULL,
      invoice_number          VARCHAR(20)   NOT NULL,
      supplier_invoice_number VARCHAR(50),
      status                  supplier_invoice_status NOT NULL DEFAULT 'draft',
      invoice_date            TIMESTAMPTZ,
      due_date                TIMESTAMPTZ,
      payment_condition       VARCHAR(20)   NOT NULL DEFAULT 'cash',
      currency                VARCHAR(3)    NOT NULL DEFAULT 'ARS',
      subtotal                NUMERIC(15,2) NOT NULL DEFAULT 0,
      discount_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
      tax_amount              NUMERIC(15,2) NOT NULL DEFAULT 0,
      total                   NUMERIC(15,2) NOT NULL DEFAULT 0,
      paid_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
      balance                 NUMERIC(15,2) NOT NULL DEFAULT 0,
      notes                   TEXT,
      internal_notes          TEXT,
      created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at              TIMESTAMPTZ,
      created_by              UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by              UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by              UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_supplier_invoices_number_org UNIQUE (invoice_number, org_id)
    );

    CREATE INDEX idx_supplier_invoices_org       ON supplier_invoices(org_id)      WHERE deleted_at IS NULL;
    CREATE INDEX idx_supplier_invoices_branch    ON supplier_invoices(branch_id)   WHERE deleted_at IS NULL AND branch_id IS NOT NULL;
    CREATE INDEX idx_supplier_invoices_contact   ON supplier_invoices(contact_id)  WHERE deleted_at IS NULL AND contact_id IS NOT NULL;
    CREATE INDEX idx_supplier_invoices_order     ON supplier_invoices(order_id)    WHERE deleted_at IS NULL AND order_id IS NOT NULL;
    CREATE INDEX idx_supplier_invoices_receipt   ON supplier_invoices(receipt_id)  WHERE deleted_at IS NULL AND receipt_id IS NOT NULL;
    CREATE INDEX idx_supplier_invoices_status    ON supplier_invoices(status)      WHERE deleted_at IS NULL;

    CREATE TABLE supplier_invoice_items (
      id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id      UUID          NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
      org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      product_id      UUID          REFERENCES products(id) ON DELETE SET NULL,
      variant_id      UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
      description     VARCHAR(500)  NOT NULL,
      quantity        NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_price      NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
      discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
      iva_rate        VARCHAR(10)   NOT NULL DEFAULT '21',
      subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      tax_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
      total           NUMERIC(15,2) NOT NULL DEFAULT 0,
      sort_order      INTEGER       NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_supplier_invoice_items_invoice ON supplier_invoice_items(invoice_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_supplier_invoice_items_variant ON supplier_invoice_items(variant_id) WHERE deleted_at IS NULL AND variant_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_supplier_invoice_items_variant;
    DROP INDEX IF EXISTS idx_supplier_invoice_items_invoice;
    DROP TABLE IF EXISTS supplier_invoice_items;

    DROP INDEX IF EXISTS idx_supplier_invoices_status;
    DROP INDEX IF EXISTS idx_supplier_invoices_receipt;
    DROP INDEX IF EXISTS idx_supplier_invoices_order;
    DROP INDEX IF EXISTS idx_supplier_invoices_contact;
    DROP INDEX IF EXISTS idx_supplier_invoices_branch;
    DROP INDEX IF EXISTS idx_supplier_invoices_org;
    DROP TABLE IF EXISTS supplier_invoices;

    DROP TYPE IF EXISTS supplier_invoice_status;
  `)
}
