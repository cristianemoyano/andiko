import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE purchase_orders    ADD COLUMN buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE purchase_receipts  ADD COLUMN buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE supplier_invoices  ADD COLUMN buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE supplier_payments  ADD COLUMN buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;

    CREATE INDEX idx_purchase_orders_buyer   ON purchase_orders(buyer_id)   WHERE deleted_at IS NULL AND buyer_id IS NOT NULL;
    CREATE INDEX idx_purchase_receipts_buyer ON purchase_receipts(buyer_id) WHERE deleted_at IS NULL AND buyer_id IS NOT NULL;
    CREATE INDEX idx_supplier_invoices_buyer ON supplier_invoices(buyer_id) WHERE deleted_at IS NULL AND buyer_id IS NOT NULL;
    CREATE INDEX idx_supplier_payments_buyer ON supplier_payments(buyer_id) WHERE deleted_at IS NULL AND buyer_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_supplier_payments_buyer;
    DROP INDEX IF EXISTS idx_supplier_invoices_buyer;
    DROP INDEX IF EXISTS idx_purchase_receipts_buyer;
    DROP INDEX IF EXISTS idx_purchase_orders_buyer;

    ALTER TABLE supplier_payments  DROP COLUMN IF EXISTS buyer_id;
    ALTER TABLE supplier_invoices  DROP COLUMN IF EXISTS buyer_id;
    ALTER TABLE purchase_receipts  DROP COLUMN IF EXISTS buyer_id;
    ALTER TABLE purchase_orders    DROP COLUMN IF EXISTS buyer_id;
  `)
}
