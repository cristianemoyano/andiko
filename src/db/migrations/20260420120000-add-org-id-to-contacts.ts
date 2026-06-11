import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

    ALTER TABLE contact_addresses
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

    ALTER TABLE contact_payment_info
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

    CREATE INDEX idx_contacts_org_id ON contacts(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_contact_addresses_org_id ON contact_addresses(org_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_contacts_org_id;
    DROP INDEX IF EXISTS idx_contact_addresses_org_id;

    ALTER TABLE contact_payment_info DROP COLUMN IF EXISTS org_id;
    ALTER TABLE contact_addresses    DROP COLUMN IF EXISTS org_id;
    ALTER TABLE contacts             DROP COLUMN IF EXISTS org_id;
  `)
}
