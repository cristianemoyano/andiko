import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE sales_quotes   ADD COLUMN salesperson_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE sales_orders   ADD COLUMN salesperson_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE invoices        ADD COLUMN salesperson_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE payments        ADD COLUMN salesperson_id UUID REFERENCES users(id) ON DELETE SET NULL;

    CREATE INDEX idx_sales_quotes_salesperson   ON sales_quotes(salesperson_id)   WHERE deleted_at IS NULL AND salesperson_id IS NOT NULL;
    CREATE INDEX idx_sales_orders_salesperson   ON sales_orders(salesperson_id)   WHERE deleted_at IS NULL AND salesperson_id IS NOT NULL;
    CREATE INDEX idx_invoices_salesperson       ON invoices(salesperson_id)       WHERE deleted_at IS NULL AND salesperson_id IS NOT NULL;
    CREATE INDEX idx_payments_salesperson       ON payments(salesperson_id)       WHERE deleted_at IS NULL AND salesperson_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_payments_salesperson;
    DROP INDEX IF EXISTS idx_invoices_salesperson;
    DROP INDEX IF EXISTS idx_sales_orders_salesperson;
    DROP INDEX IF EXISTS idx_sales_quotes_salesperson;

    ALTER TABLE payments      DROP COLUMN IF EXISTS salesperson_id;
    ALTER TABLE invoices       DROP COLUMN IF EXISTS salesperson_id;
    ALTER TABLE sales_orders  DROP COLUMN IF EXISTS salesperson_id;
    ALTER TABLE sales_quotes  DROP COLUMN IF EXISTS salesperson_id;
  `)
}
