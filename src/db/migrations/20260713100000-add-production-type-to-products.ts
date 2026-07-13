import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE products
      ADD COLUMN production_type VARCHAR(20)
      CHECK (production_type IN ('insumo', 'semielaborado', 'producto_terminado'));

    CREATE INDEX idx_products_production_type ON products(production_type)
      WHERE deleted_at IS NULL AND production_type IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_products_production_type;
    ALTER TABLE products DROP COLUMN IF EXISTS production_type;
  `)
}
