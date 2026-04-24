import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE stock_items (
      id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      variant_id   UUID          NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
      warehouse_id UUID          NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
      org_id       UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      quantity     NUMERIC(15,4) NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_stock_items_variant_warehouse UNIQUE (variant_id, warehouse_id),
      CONSTRAINT chk_stock_items_quantity CHECK (quantity >= 0)
    );

    CREATE INDEX idx_stock_items_warehouse ON stock_items(warehouse_id);
    CREATE INDEX idx_stock_items_variant   ON stock_items(variant_id);
    CREATE INDEX idx_stock_items_org       ON stock_items(org_id);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_stock_items_org;
    DROP INDEX IF EXISTS idx_stock_items_variant;
    DROP INDEX IF EXISTS idx_stock_items_warehouse;
    DROP TABLE IF EXISTS stock_items;
  `)
}
