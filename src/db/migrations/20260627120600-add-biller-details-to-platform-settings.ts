import type { Migration } from '../../lib/migrations'

/**
 * Platform issuer ("emisor") company details, stored on the singleton
 * `platform_settings` row. These are the fiscal details of the platform that
 * appear as the issuer on the subscription invoices billed to organizations.
 * All columns are nullable so the existing singleton row keeps working until
 * a sys-admin fills them in.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      ADD COLUMN biller_legal_name          VARCHAR(255),
      ADD COLUMN biller_cuit                 VARCHAR(13),
      ADD COLUMN biller_iva_condition        VARCHAR(30),
      ADD COLUMN biller_fiscal_address       VARCHAR(500),
      ADD COLUMN biller_gross_income         VARCHAR(32),
      ADD COLUMN biller_activity_start_date  DATE,
      ADD COLUMN biller_email                VARCHAR(320),
      ADD COLUMN biller_phone                VARCHAR(40);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE platform_settings
      DROP COLUMN IF EXISTS biller_legal_name,
      DROP COLUMN IF EXISTS biller_cuit,
      DROP COLUMN IF EXISTS biller_iva_condition,
      DROP COLUMN IF EXISTS biller_fiscal_address,
      DROP COLUMN IF EXISTS biller_gross_income,
      DROP COLUMN IF EXISTS biller_activity_start_date,
      DROP COLUMN IF EXISTS biller_email,
      DROP COLUMN IF EXISTS biller_phone;
  `)
}
