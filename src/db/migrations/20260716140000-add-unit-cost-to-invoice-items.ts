import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE invoice_items
      ADD COLUMN unit_cost NUMERIC(15, 2);

    ALTER TABLE invoice_items
      ADD CONSTRAINT chk_invoice_items_unit_cost_non_negative
      CHECK (unit_cost IS NULL OR unit_cost >= 0);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE invoice_items
      DROP CONSTRAINT IF EXISTS chk_invoice_items_unit_cost_non_negative;

    ALTER TABLE invoice_items
      DROP COLUMN IF EXISTS unit_cost;
  `)
}
