import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE purchase_receipt_status AS ENUM (
      'draft', 'confirmed', 'cancelled'
    );

    CREATE TABLE purchase_receipts (
      id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id         UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id      UUID          REFERENCES branches(id) ON DELETE SET NULL,
      order_id       UUID          REFERENCES purchase_orders(id) ON DELETE SET NULL,
      contact_id     UUID          REFERENCES contacts(id) ON DELETE SET NULL,
      warehouse_id   UUID          REFERENCES warehouses(id) ON DELETE SET NULL,
      receipt_number VARCHAR(20)   NOT NULL,
      status         purchase_receipt_status NOT NULL DEFAULT 'draft',
      receipt_date   TIMESTAMPTZ,
      notes          TEXT,
      internal_notes TEXT,
      created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at     TIMESTAMPTZ,
      created_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_purchase_receipts_number_org UNIQUE (receipt_number, org_id)
    );

    CREATE INDEX idx_purchase_receipts_org       ON purchase_receipts(org_id)      WHERE deleted_at IS NULL;
    CREATE INDEX idx_purchase_receipts_branch    ON purchase_receipts(branch_id)   WHERE deleted_at IS NULL AND branch_id IS NOT NULL;
    CREATE INDEX idx_purchase_receipts_order     ON purchase_receipts(order_id)    WHERE deleted_at IS NULL AND order_id IS NOT NULL;
    CREATE INDEX idx_purchase_receipts_contact   ON purchase_receipts(contact_id)  WHERE deleted_at IS NULL AND contact_id IS NOT NULL;
    CREATE INDEX idx_purchase_receipts_warehouse ON purchase_receipts(warehouse_id) WHERE deleted_at IS NULL AND warehouse_id IS NOT NULL;

    CREATE TABLE purchase_receipt_items (
      id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      receipt_id     UUID          NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
      order_item_id  UUID          REFERENCES purchase_order_items(id) ON DELETE SET NULL,
      org_id         UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      product_id     UUID          REFERENCES products(id) ON DELETE SET NULL,
      variant_id     UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
      description    VARCHAR(500)  NOT NULL,
      quantity       NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
      unit_cost      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
      sort_order     INTEGER       NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at     TIMESTAMPTZ,
      created_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by     UUID          REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_purchase_receipt_items_receipt    ON purchase_receipt_items(receipt_id)    WHERE deleted_at IS NULL;
    CREATE INDEX idx_purchase_receipt_items_order_item ON purchase_receipt_items(order_item_id) WHERE deleted_at IS NULL AND order_item_id IS NOT NULL;
    CREATE INDEX idx_purchase_receipt_items_variant    ON purchase_receipt_items(variant_id)    WHERE deleted_at IS NULL AND variant_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_purchase_receipt_items_variant;
    DROP INDEX IF EXISTS idx_purchase_receipt_items_order_item;
    DROP INDEX IF EXISTS idx_purchase_receipt_items_receipt;
    DROP TABLE IF EXISTS purchase_receipt_items;

    DROP INDEX IF EXISTS idx_purchase_receipts_warehouse;
    DROP INDEX IF EXISTS idx_purchase_receipts_contact;
    DROP INDEX IF EXISTS idx_purchase_receipts_order;
    DROP INDEX IF EXISTS idx_purchase_receipts_branch;
    DROP INDEX IF EXISTS idx_purchase_receipts_org;
    DROP TABLE IF EXISTS purchase_receipts;

    DROP TYPE IF EXISTS purchase_receipt_status;
  `)
}
