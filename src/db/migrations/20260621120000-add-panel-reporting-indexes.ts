import type { Migration } from '../../lib/migrations'

/**
 * Composite partial indexes for panel KPI / chart / activity queries.
 * Existing indexes only covered org_id or status alone — not issue_date,
 * payment_date, or updated_at ranges used by the dashboard.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE INDEX idx_invoices_org_issue_date
      ON invoices (org_id, issue_date)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_invoices_org_branch_issue_date
      ON invoices (org_id, branch_id, issue_date)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_invoices_org_status_open
      ON invoices (org_id, status)
      WHERE deleted_at IS NULL AND status IN ('issued', 'partially_paid');

    CREATE INDEX idx_invoices_org_updated_at
      ON invoices (org_id, updated_at DESC)
      WHERE deleted_at IS NULL AND status <> 'draft';

    CREATE INDEX idx_payments_org_payment_date
      ON payments (org_id, payment_date)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_payments_org_branch_payment_date
      ON payments (org_id, branch_id, payment_date)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_payments_org_updated_at
      ON payments (org_id, updated_at DESC)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_supplier_invoices_org_invoice_date
      ON supplier_invoices (org_id, invoice_date)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_supplier_invoices_org_branch_invoice_date
      ON supplier_invoices (org_id, branch_id, invoice_date)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_stock_movements_org_created_at
      ON stock_movements (org_id, created_at DESC);

    CREATE INDEX idx_purchase_orders_org_updated_at
      ON purchase_orders (org_id, updated_at DESC)
      WHERE deleted_at IS NULL AND status <> 'draft';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_purchase_orders_org_updated_at;
    DROP INDEX IF EXISTS idx_stock_movements_org_created_at;
    DROP INDEX IF EXISTS idx_supplier_invoices_org_branch_invoice_date;
    DROP INDEX IF EXISTS idx_supplier_invoices_org_invoice_date;
    DROP INDEX IF EXISTS idx_payments_org_updated_at;
    DROP INDEX IF EXISTS idx_payments_org_branch_payment_date;
    DROP INDEX IF EXISTS idx_payments_org_payment_date;
    DROP INDEX IF EXISTS idx_invoices_org_updated_at;
    DROP INDEX IF EXISTS idx_invoices_org_status_open;
    DROP INDEX IF EXISTS idx_invoices_org_branch_issue_date;
    DROP INDEX IF EXISTS idx_invoices_org_issue_date;
  `)
}
