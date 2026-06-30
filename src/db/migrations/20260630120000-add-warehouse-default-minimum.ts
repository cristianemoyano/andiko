import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE warehouses
      ADD COLUMN default_minimum_quantity NUMERIC(15,4) NOT NULL DEFAULT 0;

    ALTER TABLE warehouses
      ADD CONSTRAINT chk_warehouses_default_minimum_quantity CHECK (default_minimum_quantity >= 0);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS chk_warehouses_default_minimum_quantity;
    ALTER TABLE warehouses DROP COLUMN IF EXISTS default_minimum_quantity;
  `)
}
