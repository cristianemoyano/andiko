import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE sales_quotes
      ADD COLUMN price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL;

    ALTER TABLE sales_orders
      ADD COLUMN price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL;

    ALTER TABLE invoices
      ADD COLUMN price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL;

    CREATE INDEX idx_sales_quotes_price_list ON sales_quotes(price_list_id) WHERE deleted_at IS NULL AND price_list_id IS NOT NULL;
    CREATE INDEX idx_sales_orders_price_list ON sales_orders(price_list_id) WHERE deleted_at IS NULL AND price_list_id IS NOT NULL;
    CREATE INDEX idx_invoices_price_list     ON invoices(price_list_id)     WHERE deleted_at IS NULL AND price_list_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_invoices_price_list;
    DROP INDEX IF EXISTS idx_sales_orders_price_list;
    DROP INDEX IF EXISTS idx_sales_quotes_price_list;

    ALTER TABLE invoices    DROP COLUMN IF EXISTS price_list_id;
    ALTER TABLE sales_orders DROP COLUMN IF EXISTS price_list_id;
    ALTER TABLE sales_quotes DROP COLUMN IF EXISTS price_list_id;
  `)
}
