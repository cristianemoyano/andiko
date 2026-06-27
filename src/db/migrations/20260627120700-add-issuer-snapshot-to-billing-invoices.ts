import type { Migration } from '../../lib/migrations'

/**
 * Issuer ("emisor") snapshot on billing invoices. When an invoice is issued, the
 * platform's fiscal identity is copied here so historical invoices remain
 * accurate even if the platform later changes its details. Invoices are
 * immutable once issued, so these columns are written once at issue time.
 * All nullable — drafts and pre-existing invoices have no snapshot.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE billing_invoices
      ADD COLUMN issuer_legal_name     VARCHAR(255),
      ADD COLUMN issuer_cuit           VARCHAR(13),
      ADD COLUMN issuer_iva_condition  VARCHAR(30),
      ADD COLUMN issuer_fiscal_address VARCHAR(500),
      ADD COLUMN issuer_gross_income   VARCHAR(32),
      ADD COLUMN issuer_email          VARCHAR(320),
      ADD COLUMN issuer_phone          VARCHAR(40);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE billing_invoices
      DROP COLUMN IF EXISTS issuer_legal_name,
      DROP COLUMN IF EXISTS issuer_cuit,
      DROP COLUMN IF EXISTS issuer_iva_condition,
      DROP COLUMN IF EXISTS issuer_fiscal_address,
      DROP COLUMN IF EXISTS issuer_gross_income,
      DROP COLUMN IF EXISTS issuer_email,
      DROP COLUMN IF EXISTS issuer_phone;
  `)
}
