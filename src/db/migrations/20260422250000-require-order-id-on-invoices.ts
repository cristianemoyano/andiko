import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DELETE FROM invoices WHERE order_id IS NULL;
    ALTER TABLE invoices ALTER COLUMN order_id SET NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE invoices ALTER COLUMN order_id DROP NOT NULL;
  `)
}
