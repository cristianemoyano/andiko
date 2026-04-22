import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE order_status AS ENUM ('draft', 'confirmed', 'in_progress', 'delivered', 'cancelled');

    CREATE TABLE sales_orders (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id            UUID REFERENCES organizations(id) ON DELETE SET NULL,
      branch_id         UUID REFERENCES branches(id) ON DELETE SET NULL,
      contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
      quote_id          UUID REFERENCES sales_quotes(id) ON DELETE SET NULL,
      order_number      VARCHAR(20) NOT NULL,
      status            order_status NOT NULL DEFAULT 'draft',
      payment_condition payment_condition NOT NULL DEFAULT 'cash',
      currency          VARCHAR(3) NOT NULL DEFAULT 'ARS',
      promised_date     TIMESTAMPTZ,
      delivered_date    TIMESTAMPTZ,
      subtotal          NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      discount_amount   NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_amount        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      total             NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
      notes             TEXT,
      internal_notes    TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at        TIMESTAMPTZ,
      created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by        UUID REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (order_number, org_id)
    );

    CREATE INDEX idx_sales_orders_org_id     ON sales_orders(org_id)     WHERE deleted_at IS NULL;
    CREATE INDEX idx_sales_orders_contact_id ON sales_orders(contact_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_sales_orders_quote_id   ON sales_orders(quote_id)   WHERE deleted_at IS NULL;
    CREATE INDEX idx_sales_orders_status     ON sales_orders(status)     WHERE deleted_at IS NULL;

    CREATE TABLE sales_order_items (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id        UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      org_id          UUID REFERENCES organizations(id) ON DELETE SET NULL,
      product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
      description     VARCHAR(500) NOT NULL,
      quantity        NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_price      NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
      discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
      iva_rate        iva_rate NOT NULL DEFAULT '21',
      subtotal        NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
      discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_base        NUMERIC(15,2) NOT NULL CHECK (tax_base >= 0),
      tax_amount      NUMERIC(15,2) NOT NULL CHECK (tax_amount >= 0),
      total           NUMERIC(15,2) NOT NULL CHECK (total >= 0),
      sort_order      INT NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID,
      updated_by      UUID,
      deleted_by      UUID
    );

    CREATE INDEX idx_sales_order_items_order ON sales_order_items(order_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS sales_order_items;
    DROP TABLE IF EXISTS sales_orders;
    DROP TYPE IF EXISTS order_status;
  `)
}
