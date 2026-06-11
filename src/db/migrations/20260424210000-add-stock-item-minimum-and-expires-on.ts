import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE stock_items
      ADD COLUMN minimum_quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
      ADD COLUMN expires_on DATE NULL;

    ALTER TABLE stock_items
      ADD CONSTRAINT chk_stock_items_minimum_quantity CHECK (minimum_quantity >= 0);

    CREATE INDEX idx_stock_items_org_expires
      ON stock_items (org_id, expires_on)
      WHERE expires_on IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_stock_items_org_expires;
    ALTER TABLE stock_items DROP CONSTRAINT IF EXISTS chk_stock_items_minimum_quantity;
    ALTER TABLE stock_items DROP COLUMN IF EXISTS expires_on;
    ALTER TABLE stock_items DROP COLUMN IF EXISTS minimum_quantity;
  `)
}
