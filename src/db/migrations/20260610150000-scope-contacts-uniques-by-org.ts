import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_cuit_key;
    CREATE UNIQUE INDEX uq_contacts_org_cuit
      ON contacts (org_id, cuit)
      WHERE deleted_at IS NULL AND cuit IS NOT NULL;

    ALTER TABLE contact_payment_info DROP CONSTRAINT IF EXISTS contact_payment_info_cbu_key;
    CREATE UNIQUE INDEX uq_contact_payment_info_org_cbu
      ON contact_payment_info (org_id, cbu)
      WHERE deleted_at IS NULL AND cbu IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS uq_contacts_org_cuit;
    DROP INDEX IF EXISTS uq_contact_payment_info_org_cbu;

    CREATE UNIQUE INDEX contacts_cuit_key ON contacts (cuit) WHERE cuit IS NOT NULL;
    CREATE UNIQUE INDEX contact_payment_info_cbu_key ON contact_payment_info (cbu) WHERE cbu IS NOT NULL;
  `)
}
