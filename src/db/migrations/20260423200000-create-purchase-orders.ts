import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE purchase_order_status AS ENUM (
      'draft', 'sent', 'partially_received', 'received', 'cancelled'
    );

    CREATE TABLE purchase_orders (
      id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id            UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id         UUID          REFERENCES branches(id) ON DELETE SET NULL,
      contact_id        UUID          REFERENCES contacts(id) ON DELETE SET NULL,
      order_number      VARCHAR(20)   NOT NULL,
      status            purchase_order_status NOT NULL DEFAULT 'draft',
      expected_date     TIMESTAMPTZ,
      currency          VARCHAR(3)    NOT NULL DEFAULT 'ARS',
      payment_condition VARCHAR(20)   NOT NULL DEFAULT 'cash',
      subtotal          NUMERIC(15,2) NOT NULL DEFAULT 0,
      discount_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
      tax_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
      total             NUMERIC(15,2) NOT NULL DEFAULT 0,
      notes             TEXT,
      internal_notes    TEXT,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at        TIMESTAMPTZ,
      created_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_purchase_orders_number_org UNIQUE (order_number, org_id)
    );

    CREATE INDEX idx_purchase_orders_org        ON purchase_orders(org_id)       WHERE deleted_at IS NULL;
    CREATE INDEX idx_purchase_orders_branch     ON purchase_orders(branch_id)    WHERE deleted_at IS NULL AND branch_id IS NOT NULL;
    CREATE INDEX idx_purchase_orders_contact    ON purchase_orders(contact_id)   WHERE deleted_at IS NULL AND contact_id IS NOT NULL;
    CREATE INDEX idx_purchase_orders_status     ON purchase_orders(status)       WHERE deleted_at IS NULL;

    CREATE TABLE purchase_order_items (
      id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id        UUID          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      product_id      UUID          REFERENCES products(id) ON DELETE SET NULL,
      variant_id      UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
      description     VARCHAR(500)  NOT NULL,
      quantity        NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      received_qty    NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
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

    CREATE INDEX idx_purchase_order_items_order   ON purchase_order_items(order_id)   WHERE deleted_at IS NULL;
    CREATE INDEX idx_purchase_order_items_variant ON purchase_order_items(variant_id) WHERE deleted_at IS NULL AND variant_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_purchase_order_items_variant;
    DROP INDEX IF EXISTS idx_purchase_order_items_order;
    DROP TABLE IF EXISTS purchase_order_items;

    DROP INDEX IF EXISTS idx_purchase_orders_status;
    DROP INDEX IF EXISTS idx_purchase_orders_contact;
    DROP INDEX IF EXISTS idx_purchase_orders_branch;
    DROP INDEX IF EXISTS idx_purchase_orders_org;
    DROP TABLE IF EXISTS purchase_orders;

    DROP TYPE IF EXISTS purchase_order_status;
  `)
}
