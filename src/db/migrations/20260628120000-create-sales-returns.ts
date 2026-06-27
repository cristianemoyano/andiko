import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partial_returned';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returned';

    ALTER TABLE sales_order_items
      ADD COLUMN IF NOT EXISTS returned_qty NUMERIC(15,4) NOT NULL DEFAULT 0;

    ALTER TABLE sales_order_items
      DROP CONSTRAINT IF EXISTS chk_sales_order_items_returned_qty;

    ALTER TABLE sales_order_items
      ADD CONSTRAINT chk_sales_order_items_returned_qty
      CHECK (returned_qty >= 0 AND returned_qty <= quantity);

    CREATE TABLE sales_returns (
      id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id               UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id            UUID          REFERENCES branches(id) ON DELETE SET NULL,
      order_id             UUID          NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
      invoice_id           UUID          REFERENCES invoices(id) ON DELETE SET NULL,
      credit_note_id       UUID          UNIQUE REFERENCES credit_notes(id) ON DELETE SET NULL,
      exchange_invoice_id  UUID          REFERENCES invoices(id) ON DELETE SET NULL,
      warehouse_id         UUID          REFERENCES warehouses(id) ON DELETE SET NULL,
      return_number        VARCHAR(20)   NOT NULL,
      operation_type       VARCHAR(20)   NOT NULL DEFAULT 'return'
                             CHECK (operation_type IN ('return', 'exchange')),
      status               VARCHAR(20)   NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'confirmed', 'completed', 'cancelled')),
      source               VARCHAR(10)   NOT NULL DEFAULT 'erp'
                             CHECK (source IN ('erp', 'pos')),
      pos_local_id         VARCHAR(128),
      refund_disposition   VARCHAR(20)
                             CHECK (refund_disposition IS NULL OR refund_disposition IN ('account_credit', 'cash_refund')),
      returned_subtotal    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (returned_subtotal >= 0),
      returned_discount    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (returned_discount >= 0),
      returned_tax         NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (returned_tax >= 0),
      returned_total       NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (returned_total >= 0),
      exchange_subtotal    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (exchange_subtotal >= 0),
      exchange_discount    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (exchange_discount >= 0),
      exchange_tax         NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (exchange_tax >= 0),
      exchange_total       NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (exchange_total >= 0),
      difference_total     NUMERIC(15,2) NOT NULL DEFAULT 0,
      reason               TEXT,
      notes                TEXT,
      completed_at         TIMESTAMPTZ,
      created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at           TIMESTAMPTZ,
      created_by           UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by           UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by           UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_sales_returns_number_org UNIQUE (org_id, return_number)
    );

    CREATE UNIQUE INDEX uq_sales_returns_pos_local
      ON sales_returns (org_id, pos_local_id)
      WHERE pos_local_id IS NOT NULL AND deleted_at IS NULL;

    CREATE INDEX idx_sales_returns_org     ON sales_returns(org_id)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_sales_returns_order   ON sales_returns(order_id)   WHERE deleted_at IS NULL;
    CREATE INDEX idx_sales_returns_invoice ON sales_returns(invoice_id) WHERE deleted_at IS NULL AND invoice_id IS NOT NULL;
    CREATE INDEX idx_sales_returns_status  ON sales_returns(status)     WHERE deleted_at IS NULL;

    CREATE TABLE sales_return_items (
      id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      return_id           UUID          NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
      org_id              UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      order_item_id       UUID          NOT NULL REFERENCES sales_order_items(id) ON DELETE RESTRICT,
      invoice_item_id     UUID          REFERENCES invoice_items(id) ON DELETE SET NULL,
      product_id          UUID          REFERENCES products(id) ON DELETE SET NULL,
      variant_id          UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
      description         VARCHAR(500)  NOT NULL,
      quantity            NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_price          NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
      discount_pct        NUMERIC(5,2)  NOT NULL DEFAULT 0,
      iva_rate            iva_rate      NOT NULL DEFAULT '21',
      subtotal            NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
      discount_amount     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_base            NUMERIC(15,2) NOT NULL CHECK (tax_base >= 0),
      tax_amount          NUMERIC(15,2) NOT NULL CHECK (tax_amount >= 0),
      total               NUMERIC(15,2) NOT NULL CHECK (total >= 0),
      batch_code          VARCHAR(100),
      expiry_date         DATE,
      sort_order          INTEGER       NOT NULL DEFAULT 0,
      created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at          TIMESTAMPTZ,
      created_by          UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by          UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by          UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_sales_return_items_return ON sales_return_items(return_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_sales_return_items_order_item ON sales_return_items(order_item_id) WHERE deleted_at IS NULL;

    CREATE TABLE sales_return_exchange_items (
      id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      return_id       UUID          NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
      org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      product_id      UUID          REFERENCES products(id) ON DELETE SET NULL,
      variant_id      UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
      description     VARCHAR(500)  NOT NULL,
      quantity        NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_price      NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
      discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
      iva_rate        iva_rate      NOT NULL DEFAULT '21',
      subtotal        NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
      discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_base        NUMERIC(15,2) NOT NULL CHECK (tax_base >= 0),
      tax_amount      NUMERIC(15,2) NOT NULL CHECK (tax_amount >= 0),
      total           NUMERIC(15,2) NOT NULL CHECK (total >= 0),
      sort_order      INTEGER       NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_sales_return_exchange_items_return ON sales_return_exchange_items(return_id) WHERE deleted_at IS NULL;

    CREATE TABLE credit_note_items (
      id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      credit_note_id  UUID          NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
      org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invoice_item_id UUID          REFERENCES invoice_items(id) ON DELETE SET NULL,
      product_id      UUID          REFERENCES products(id) ON DELETE SET NULL,
      variant_id      UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
      description     VARCHAR(500)  NOT NULL,
      quantity        NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_price      NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
      discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
      iva_rate        iva_rate      NOT NULL DEFAULT '21',
      subtotal        NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
      discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_base        NUMERIC(15,2) NOT NULL CHECK (tax_base >= 0),
      tax_amount      NUMERIC(15,2) NOT NULL CHECK (tax_amount >= 0),
      total           NUMERIC(15,2) NOT NULL CHECK (total >= 0),
      sort_order      INTEGER       NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_credit_note_items_note ON credit_note_items(credit_note_id) WHERE deleted_at IS NULL;

    ALTER TABLE credit_notes
      ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS return_id UUID UNIQUE REFERENCES sales_returns(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_credit_notes_order_id ON credit_notes(order_id) WHERE deleted_at IS NULL AND order_id IS NOT NULL;

    CREATE TABLE sales_refunds (
      id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id       UUID          REFERENCES branches(id) ON DELETE SET NULL,
      return_id       UUID          NOT NULL REFERENCES sales_returns(id) ON DELETE RESTRICT,
      credit_note_id  UUID          REFERENCES credit_notes(id) ON DELETE SET NULL,
      payment_id      UUID          REFERENCES payments(id) ON DELETE SET NULL,
      refund_number   VARCHAR(20)   NOT NULL,
      amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
      refund_method   VARCHAR(30)   NOT NULL,
      refund_date     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      reference       VARCHAR(255),
      notes           TEXT,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by      UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_sales_refunds_number_org UNIQUE (org_id, refund_number)
    );

    CREATE INDEX idx_sales_refunds_return ON sales_refunds(return_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_sales_refunds_org    ON sales_refunds(org_id)    WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_sales_refunds_org;
    DROP INDEX IF EXISTS idx_sales_refunds_return;
    DROP TABLE IF EXISTS sales_refunds;

    DROP INDEX IF EXISTS idx_credit_notes_order_id;
    ALTER TABLE credit_notes DROP COLUMN IF EXISTS return_id;
    ALTER TABLE credit_notes DROP COLUMN IF EXISTS order_id;

    DROP INDEX IF EXISTS idx_credit_note_items_note;
    DROP TABLE IF EXISTS credit_note_items;

    DROP INDEX IF EXISTS idx_sales_return_exchange_items_return;
    DROP TABLE IF EXISTS sales_return_exchange_items;

    DROP INDEX IF EXISTS idx_sales_return_items_order_item;
    DROP INDEX IF EXISTS idx_sales_return_items_return;
    DROP TABLE IF EXISTS sales_return_items;

    DROP INDEX IF EXISTS idx_sales_returns_status;
    DROP INDEX IF EXISTS idx_sales_returns_invoice;
    DROP INDEX IF EXISTS idx_sales_returns_order;
    DROP INDEX IF EXISTS idx_sales_returns_org;
    DROP INDEX IF EXISTS uq_sales_returns_pos_local;
    DROP TABLE IF EXISTS sales_returns;

    ALTER TABLE sales_order_items DROP CONSTRAINT IF EXISTS chk_sales_order_items_returned_qty;
    ALTER TABLE sales_order_items DROP COLUMN IF EXISTS returned_qty;
  `)
}
