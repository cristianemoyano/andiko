import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

    ALTER TABLE contact_addresses
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

    ALTER TABLE contact_payment_info
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

    CREATE INDEX idx_contacts_created_by ON contacts (created_by) WHERE deleted_at IS NULL;
    CREATE INDEX idx_contact_addresses_created_by ON contact_addresses (created_by) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_contacts_created_by;
    DROP INDEX IF EXISTS idx_contact_addresses_created_by;

    ALTER TABLE contact_payment_info
      DROP COLUMN IF EXISTS created_by,
      DROP COLUMN IF EXISTS updated_by,
      DROP COLUMN IF EXISTS deleted_by;

    ALTER TABLE contact_addresses
      DROP COLUMN IF EXISTS created_by,
      DROP COLUMN IF EXISTS updated_by,
      DROP COLUMN IF EXISTS deleted_by;

    ALTER TABLE contacts
      DROP COLUMN IF EXISTS created_by,
      DROP COLUMN IF EXISTS updated_by,
      DROP COLUMN IF EXISTS deleted_by;
  `)
}
