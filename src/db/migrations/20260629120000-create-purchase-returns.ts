import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TYPE purchase_order_status ADD VALUE IF NOT EXISTS 'partial_returned';
    ALTER TYPE purchase_order_status ADD VALUE IF NOT EXISTS 'returned';

    ALTER TABLE purchase_order_items
      ADD COLUMN IF NOT EXISTS returned_qty NUMERIC(15,4) NOT NULL DEFAULT 0;

    ALTER TABLE purchase_order_items
      DROP CONSTRAINT IF EXISTS chk_purchase_order_items_returned_qty;

    ALTER TABLE purchase_order_items
      ADD CONSTRAINT chk_purchase_order_items_returned_qty
      CHECK (returned_qty >= 0 AND returned_qty <= received_qty);

    CREATE TABLE purchase_returns (
      id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id            UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id         UUID          REFERENCES branches(id) ON DELETE SET NULL,
      order_id          UUID          NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
      invoice_id        UUID          REFERENCES supplier_invoices(id) ON DELETE SET NULL,
      receipt_id        UUID          REFERENCES purchase_receipts(id) ON DELETE SET NULL,
      warehouse_id      UUID          REFERENCES warehouses(id) ON DELETE SET NULL,
      return_number     VARCHAR(20)   NOT NULL,
      operation_type    VARCHAR(20)   NOT NULL DEFAULT 'return'
                          CHECK (operation_type IN ('return', 'exchange')),
      status            VARCHAR(20)   NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'confirmed', 'completed', 'cancelled')),
      returned_subtotal NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (returned_subtotal >= 0),
      returned_discount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (returned_discount >= 0),
      returned_tax      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (returned_tax >= 0),
      returned_total    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (returned_total >= 0),
      exchange_subtotal NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (exchange_subtotal >= 0),
      exchange_discount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (exchange_discount >= 0),
      exchange_tax      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (exchange_tax >= 0),
      exchange_total    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (exchange_total >= 0),
      difference_total  NUMERIC(15,2) NOT NULL DEFAULT 0,
      reason            TEXT,
      notes             TEXT,
      completed_at      TIMESTAMPTZ,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at        TIMESTAMPTZ,
      created_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_purchase_returns_number_org UNIQUE (org_id, return_number)
    );

    CREATE INDEX idx_purchase_returns_org     ON purchase_returns(org_id)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_purchase_returns_order   ON purchase_returns(order_id)   WHERE deleted_at IS NULL;
    CREATE INDEX idx_purchase_returns_invoice ON purchase_returns(invoice_id) WHERE deleted_at IS NULL AND invoice_id IS NOT NULL;
    CREATE INDEX idx_purchase_returns_status  ON purchase_returns(status)     WHERE deleted_at IS NULL;

    CREATE TABLE purchase_return_items (
      id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      return_id       UUID          NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
      org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      order_item_id   UUID          NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
      product_id      UUID          REFERENCES products(id) ON DELETE SET NULL,
      variant_id      UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
      description     VARCHAR(500)  NOT NULL,
      quantity        NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_price      NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
      discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
      iva_rate        VARCHAR(10)   NOT NULL DEFAULT '21',
      subtotal        NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
      discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_base        NUMERIC(15,2) NOT NULL CHECK (tax_base >= 0),
      tax_amount      NUMERIC(15,2) NOT NULL CHECK (tax_amount >= 0),
      total           NUMERIC(15,2) NOT NULL CHECK (total >= 0),
      batch_code      VARCHAR(100),
      expiry_date     DATE,
      sort_order      INTEGER       NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_purchase_return_items_return     ON purchase_return_items(return_id)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_purchase_return_items_order_item ON purchase_return_items(order_item_id) WHERE deleted_at IS NULL;

    CREATE TABLE purchase_return_exchange_items (
      id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      return_id       UUID          NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
      org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      product_id      UUID          REFERENCES products(id) ON DELETE SET NULL,
      variant_id      UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
      description     VARCHAR(500)  NOT NULL,
      quantity        NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_price      NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
      discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
      iva_rate        VARCHAR(10)   NOT NULL DEFAULT '21',
      subtotal        NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
      discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_base        NUMERIC(15,2) NOT NULL CHECK (tax_base >= 0),
      tax_amount      NUMERIC(15,2) NOT NULL CHECK (tax_amount >= 0),
      total           NUMERIC(15,2) NOT NULL CHECK (total >= 0),
      batch_code      VARCHAR(100),
      expiry_date     DATE,
      sort_order      INTEGER       NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_purchase_return_exchange_items_return ON purchase_return_exchange_items(return_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_purchase_return_exchange_items_return;
    DROP TABLE IF EXISTS purchase_return_exchange_items;

    DROP INDEX IF EXISTS idx_purchase_return_items_order_item;
    DROP INDEX IF EXISTS idx_purchase_return_items_return;
    DROP TABLE IF EXISTS purchase_return_items;

    DROP INDEX IF EXISTS idx_purchase_returns_status;
    DROP INDEX IF EXISTS idx_purchase_returns_invoice;
    DROP INDEX IF EXISTS idx_purchase_returns_order;
    DROP INDEX IF EXISTS idx_purchase_returns_org;
    DROP TABLE IF EXISTS purchase_returns;

    ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS chk_purchase_order_items_returned_qty;
    ALTER TABLE purchase_order_items DROP COLUMN IF EXISTS returned_qty;
  `)
}
