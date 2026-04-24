import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE sales_quote_items
      ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

    ALTER TABLE sales_order_items
      ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

    ALTER TABLE invoice_items
      ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

    CREATE INDEX idx_sales_quote_items_variant  ON sales_quote_items(variant_id)  WHERE deleted_at IS NULL AND variant_id IS NOT NULL;
    CREATE INDEX idx_sales_order_items_variant  ON sales_order_items(variant_id)  WHERE deleted_at IS NULL AND variant_id IS NOT NULL;
    CREATE INDEX idx_invoice_items_variant      ON invoice_items(variant_id)      WHERE deleted_at IS NULL AND variant_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_invoice_items_variant;
    DROP INDEX IF EXISTS idx_sales_order_items_variant;
    DROP INDEX IF EXISTS idx_sales_quote_items_variant;

    ALTER TABLE invoice_items     DROP COLUMN IF EXISTS variant_id;
    ALTER TABLE sales_order_items DROP COLUMN IF EXISTS variant_id;
    ALTER TABLE sales_quote_items DROP COLUMN IF EXISTS variant_id;
  `)
}
