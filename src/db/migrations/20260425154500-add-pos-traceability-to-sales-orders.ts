import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE sales_orders
      ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'erp',
      ADD COLUMN pos_device_id VARCHAR(128),
      ADD COLUMN pos_sale_id VARCHAR(128);

    ALTER TABLE sales_orders
      ADD CONSTRAINT chk_sales_orders_source
      CHECK (source IN ('erp', 'pos'));

    -- Prevent duplicates when POS retries sync.
    CREATE UNIQUE INDEX uq_sales_orders_pos_device_sale
      ON sales_orders (org_id, pos_device_id, pos_sale_id)
      WHERE deleted_at IS NULL AND source = 'pos' AND pos_device_id IS NOT NULL AND pos_sale_id IS NOT NULL;

    CREATE INDEX idx_sales_orders_source
      ON sales_orders (org_id, source)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_sales_orders_pos_device
      ON sales_orders (org_id, pos_device_id)
      WHERE deleted_at IS NULL AND source = 'pos' AND pos_device_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_sales_orders_pos_device;
    DROP INDEX IF EXISTS idx_sales_orders_source;
    DROP INDEX IF EXISTS uq_sales_orders_pos_device_sale;
    ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS chk_sales_orders_source;
    ALTER TABLE sales_orders
      DROP COLUMN IF EXISTS pos_sale_id,
      DROP COLUMN IF EXISTS pos_device_id,
      DROP COLUMN IF EXISTS source;
  `)
}

