import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    -- Branches: enable composite FK targets
    CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_id_org
      ON branches (id, org_id)
      WHERE deleted_at IS NULL;

    -- -----------------------------
    -- SALES: backfill org/branch
    -- -----------------------------
    UPDATE sales_quotes sq
    SET org_id = u.org_id
    FROM users u
    WHERE sq.org_id IS NULL AND sq.created_by = u.id AND u.org_id IS NOT NULL;

    UPDATE sales_quotes sq
    SET branch_id = u.branch_id
    FROM users u
    WHERE sq.branch_id IS NULL AND sq.created_by = u.id AND u.branch_id IS NOT NULL;

    UPDATE sales_orders so
    SET org_id = u.org_id
    FROM users u
    WHERE so.org_id IS NULL AND so.created_by = u.id AND u.org_id IS NOT NULL;

    UPDATE sales_orders so
    SET branch_id = u.branch_id
    FROM users u
    WHERE so.branch_id IS NULL AND so.created_by = u.id AND u.branch_id IS NOT NULL;

    UPDATE invoices i
    SET org_id = u.org_id
    FROM users u
    WHERE i.org_id IS NULL AND i.created_by = u.id AND u.org_id IS NOT NULL;

    UPDATE invoices i
    SET branch_id = u.branch_id
    FROM users u
    WHERE i.branch_id IS NULL AND i.created_by = u.id AND u.branch_id IS NOT NULL;

    UPDATE payments p
    SET org_id = u.org_id
    FROM users u
    WHERE p.org_id IS NULL AND p.created_by = u.id AND u.org_id IS NOT NULL;

    UPDATE payments p
    SET branch_id = u.branch_id
    FROM users u
    WHERE p.branch_id IS NULL AND p.created_by = u.id AND u.branch_id IS NOT NULL;

    -- Sales items: inherit org_id from parent documents
    UPDATE sales_quote_items i
    SET org_id = sq.org_id
    FROM sales_quotes sq
    WHERE i.org_id IS NULL AND i.quote_id = sq.id AND sq.org_id IS NOT NULL;

    UPDATE sales_order_items i
    SET org_id = so.org_id
    FROM sales_orders so
    WHERE i.org_id IS NULL AND i.order_id = so.id AND so.org_id IS NOT NULL;

    UPDATE invoice_items i
    SET org_id = inv.org_id
    FROM invoices inv
    WHERE i.org_id IS NULL AND i.invoice_id = inv.id AND inv.org_id IS NOT NULL;

    -- Enforce NOT NULL (sales)
    ALTER TABLE sales_quotes ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE sales_quotes ALTER COLUMN branch_id SET NOT NULL;
    ALTER TABLE sales_orders ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE sales_orders ALTER COLUMN branch_id SET NOT NULL;
    ALTER TABLE invoices ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE invoices ALTER COLUMN branch_id SET NOT NULL;
    ALTER TABLE payments ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE payments ALTER COLUMN branch_id SET NOT NULL;

    ALTER TABLE sales_quote_items ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE sales_order_items ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE invoice_items ALTER COLUMN org_id SET NOT NULL;

    -- Replace branch FK with composite FK (branch_id, org_id) -> branches(id, org_id)
    ALTER TABLE sales_quotes DROP CONSTRAINT IF EXISTS sales_quotes_branch_id_fkey;
    ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_branch_id_fkey;
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_branch_id_fkey;
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_branch_id_fkey;

    ALTER TABLE sales_quotes
      ADD CONSTRAINT fk_sales_quotes_branch_org
      FOREIGN KEY (branch_id, org_id) REFERENCES branches (id, org_id) ON DELETE RESTRICT;

    ALTER TABLE sales_orders
      ADD CONSTRAINT fk_sales_orders_branch_org
      FOREIGN KEY (branch_id, org_id) REFERENCES branches (id, org_id) ON DELETE RESTRICT;

    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_branch_org
      FOREIGN KEY (branch_id, org_id) REFERENCES branches (id, org_id) ON DELETE RESTRICT;

    ALTER TABLE payments
      ADD CONSTRAINT fk_payments_branch_org
      FOREIGN KEY (branch_id, org_id) REFERENCES branches (id, org_id) ON DELETE RESTRICT;

    -- Helpful indexes for branch-scoped reads
    CREATE INDEX IF NOT EXISTS idx_sales_quotes_org_branch ON sales_quotes (org_id, branch_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_sales_orders_org_branch ON sales_orders (org_id, branch_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_invoices_org_branch     ON invoices     (org_id, branch_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_payments_org_branch     ON payments     (org_id, branch_id) WHERE deleted_at IS NULL;

    -- -----------------------------
    -- CONTACTS: backfill and enforce org_id
    -- -----------------------------
    UPDATE contacts c
    SET org_id = u.org_id
    FROM users u
    WHERE c.org_id IS NULL AND c.created_by = u.id AND u.org_id IS NOT NULL;

    UPDATE contact_addresses a
    SET org_id = c.org_id
    FROM contacts c
    WHERE a.org_id IS NULL AND a.contact_id = c.id AND c.org_id IS NOT NULL;

    UPDATE contact_payment_info p
    SET org_id = c.org_id
    FROM contacts c
    WHERE p.org_id IS NULL AND p.contact_id = c.id AND c.org_id IS NOT NULL;

    ALTER TABLE contacts ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE contact_addresses ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE contact_payment_info ALTER COLUMN org_id SET NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts (org_id) WHERE deleted_at IS NULL;

    -- -----------------------------
    -- CATALOG: backfill and enforce org_id
    -- -----------------------------
    UPDATE product_categories pc
    SET org_id = u.org_id
    FROM users u
    WHERE pc.org_id IS NULL AND pc.created_by = u.id AND u.org_id IS NOT NULL;

    UPDATE products p
    SET org_id = u.org_id
    FROM users u
    WHERE p.org_id IS NULL AND p.created_by = u.id AND u.org_id IS NOT NULL;

    UPDATE product_variants v
    SET org_id = p.org_id
    FROM products p
    WHERE v.org_id IS NULL AND v.product_id = p.id AND p.org_id IS NOT NULL;

    UPDATE price_lists pl
    SET org_id = u.org_id
    FROM users u
    WHERE pl.org_id IS NULL AND pl.created_by = u.id AND u.org_id IS NOT NULL;

    UPDATE price_list_items pli
    SET org_id = pl.org_id
    FROM price_lists pl
    WHERE pli.org_id IS NULL AND pli.price_list_id = pl.id AND pl.org_id IS NOT NULL;

    ALTER TABLE product_categories ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE products           ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE product_variants   ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE price_lists        ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE price_list_items   ALTER COLUMN org_id SET NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_products_org_id ON products (org_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_product_categories_org_id ON product_categories (org_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_price_lists_org_id ON price_lists (org_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    -- Catalog
    DROP INDEX IF EXISTS idx_price_lists_org_id;
    DROP INDEX IF EXISTS idx_product_categories_org_id;
    DROP INDEX IF EXISTS idx_products_org_id;
    ALTER TABLE price_list_items   ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE price_lists        ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE product_variants   ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE products           ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE product_categories ALTER COLUMN org_id DROP NOT NULL;

    -- Contacts
    DROP INDEX IF EXISTS idx_contacts_org_id;
    ALTER TABLE contact_payment_info ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE contact_addresses    ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE contacts             ALTER COLUMN org_id DROP NOT NULL;

    -- Sales: constraints and indexes
    DROP INDEX IF EXISTS idx_payments_org_branch;
    DROP INDEX IF EXISTS idx_invoices_org_branch;
    DROP INDEX IF EXISTS idx_sales_orders_org_branch;
    DROP INDEX IF EXISTS idx_sales_quotes_org_branch;

    ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_branch_org;
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS fk_invoices_branch_org;
    ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS fk_sales_orders_branch_org;
    ALTER TABLE sales_quotes DROP CONSTRAINT IF EXISTS fk_sales_quotes_branch_org;

    -- NOTE: we don't re-add the original single-column FKs here.
    ALTER TABLE invoice_items      ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE sales_order_items  ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE sales_quote_items  ALTER COLUMN org_id DROP NOT NULL;

    ALTER TABLE payments     ALTER COLUMN branch_id DROP NOT NULL;
    ALTER TABLE payments     ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE invoices     ALTER COLUMN branch_id DROP NOT NULL;
    ALTER TABLE invoices     ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE sales_orders ALTER COLUMN branch_id DROP NOT NULL;
    ALTER TABLE sales_orders ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE sales_quotes ALTER COLUMN branch_id DROP NOT NULL;
    ALTER TABLE sales_quotes ALTER COLUMN org_id DROP NOT NULL;

    DROP INDEX IF EXISTS uq_branches_id_org;
  `)
}

