import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE purchase_receipts
      ADD CONSTRAINT fk_purchase_receipts_warehouse
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE purchase_receipts
      DROP CONSTRAINT IF EXISTS fk_purchase_receipts_warehouse;
  `)
}
