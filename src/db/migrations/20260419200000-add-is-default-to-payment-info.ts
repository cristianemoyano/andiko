import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE contact_payment_info
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;
  `)
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX idx_contact_payment_info_one_default_per_contact
      ON contact_payment_info (contact_id)
      WHERE is_default = true AND deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_contact_payment_info_one_default_per_contact;
  `)
  await queryInterface.sequelize.query(`
    ALTER TABLE contact_payment_info
      DROP COLUMN IF EXISTS is_default;
  `)
}
