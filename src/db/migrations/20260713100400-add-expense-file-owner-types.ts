import type { Migration } from '../../lib/migrations'

/** Extend attachable owner types for Expensas (expense invoices and payments). */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE file_links DROP CONSTRAINT IF EXISTS file_links_owner_type_check;
    ALTER TABLE file_links ADD CONSTRAINT file_links_owner_type_check
      CHECK (owner_type IN (
        'invoice',
        'product',
        'contact',
        'supplier_invoice',
        'purchase_receipt',
        'expense',
        'expense_payment'
      ));
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE file_links DROP CONSTRAINT IF EXISTS file_links_owner_type_check;
    ALTER TABLE file_links ADD CONSTRAINT file_links_owner_type_check
      CHECK (owner_type IN (
        'invoice',
        'product',
        'contact',
        'supplier_invoice',
        'purchase_receipt'
      ));
  `)
}
