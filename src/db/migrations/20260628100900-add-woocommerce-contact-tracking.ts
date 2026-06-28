import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE contacts
      ADD COLUMN import_source VARCHAR(32),
      ADD COLUMN import_external_id VARCHAR(64);

    CREATE UNIQUE INDEX idx_contacts_org_source_external_id
      ON contacts (org_id, import_source, import_external_id)
      WHERE deleted_at IS NULL
        AND import_external_id IS NOT NULL
        AND import_source IS NOT NULL
        AND org_id IS NOT NULL;

    ALTER TABLE woocommerce_customer_links
      ADD COLUMN last_synced_at TIMESTAMPTZ;

    CREATE INDEX idx_woo_customer_links_site_contact
      ON woocommerce_customer_links (site_id, contact_id);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_woo_customer_links_site_contact;
    ALTER TABLE woocommerce_customer_links DROP COLUMN IF EXISTS last_synced_at;
    DROP INDEX IF EXISTS idx_contacts_org_source_external_id;
    ALTER TABLE contacts DROP COLUMN IF EXISTS import_external_id;
    ALTER TABLE contacts DROP COLUMN IF EXISTS import_source;
  `)
}
