import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE product_variants
      ADD COLUMN allow_backorder BOOLEAN NOT NULL DEFAULT false;

    ALTER TABLE product_variants
      ADD CONSTRAINT chk_product_variants_backorder_requires_manage_stock
      CHECK (NOT allow_backorder OR manage_stock);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE product_variants
      DROP CONSTRAINT IF EXISTS chk_product_variants_backorder_requires_manage_stock;

    ALTER TABLE product_variants
      DROP COLUMN IF EXISTS allow_backorder;
  `)
}
