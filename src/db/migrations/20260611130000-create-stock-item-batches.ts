import type { Migration } from '../../lib/migrations'

/**
 * Batch/lot traceability (FEFO).
 *
 * Introduces `stock_item_batches`: per-batch quantity + expiry under each
 * `stock_items` aggregate row. `stock_items.quantity` remains the authoritative
 * aggregate (= SUM of its batches). A "legacy/default" batch is one with both
 * `batch_code` and `expiry_date` NULL — inbound movements without an explicit
 * lot land there, preserving the pre-batch behaviour.
 *
 * Also adds a nullable `batch_id` on `stock_movements` (the explicit link),
 * and backfills one legacy batch per existing stock_item so aggregates stay
 * consistent on day one.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE stock_item_batches (
      id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id        UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      stock_item_id UUID          NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
      batch_code    VARCHAR(100),
      expiry_date   DATE,
      quantity      NUMERIC(15,4) NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at    TIMESTAMPTZ,
      CONSTRAINT chk_stock_item_batches_quantity CHECK (quantity >= 0)
    );

    CREATE INDEX idx_stock_item_batches_stock_item ON stock_item_batches(stock_item_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_stock_item_batches_org         ON stock_item_batches(org_id);
    CREATE INDEX idx_stock_item_batches_expiry
      ON stock_item_batches(stock_item_id, expiry_date)
      WHERE deleted_at IS NULL;

    -- One named batch per (stock_item, batch_code) while live.
    CREATE UNIQUE INDEX uq_stock_item_batches_named
      ON stock_item_batches(stock_item_id, batch_code)
      WHERE deleted_at IS NULL AND batch_code IS NOT NULL;

    -- At most one legacy/default batch (batch_code IS NULL) per stock_item while live.
    CREATE UNIQUE INDEX uq_stock_item_batches_default
      ON stock_item_batches(stock_item_id)
      WHERE deleted_at IS NULL AND batch_code IS NULL;

    -- Explicit link from each ledger row to the batch it touched.
    ALTER TABLE stock_movements
      ADD COLUMN batch_id UUID REFERENCES stock_item_batches(id) ON DELETE SET NULL;

    CREATE INDEX idx_stock_movements_batch ON stock_movements(batch_id) WHERE batch_id IS NOT NULL;

    -- Inbound lot fields captured at receipt-item level (known at confirm time).
    ALTER TABLE purchase_receipt_items
      ADD COLUMN batch_code  VARCHAR(100),
      ADD COLUMN expiry_date DATE;

    -- Backfill: one legacy batch per existing stock_item carrying current qty + expiry.
    INSERT INTO stock_item_batches (org_id, stock_item_id, batch_code, expiry_date, quantity, created_at, updated_at)
    SELECT org_id, id, NULL, expires_on, quantity, NOW(), NOW()
    FROM stock_items;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE purchase_receipt_items DROP COLUMN IF EXISTS expiry_date;
    ALTER TABLE purchase_receipt_items DROP COLUMN IF EXISTS batch_code;
    DROP INDEX IF EXISTS idx_stock_movements_batch;
    ALTER TABLE stock_movements DROP COLUMN IF EXISTS batch_id;
    DROP INDEX IF EXISTS uq_stock_item_batches_default;
    DROP INDEX IF EXISTS uq_stock_item_batches_named;
    DROP INDEX IF EXISTS idx_stock_item_batches_expiry;
    DROP INDEX IF EXISTS idx_stock_item_batches_org;
    DROP INDEX IF EXISTS idx_stock_item_batches_stock_item;
    DROP TABLE IF EXISTS stock_item_batches;
  `)
}
