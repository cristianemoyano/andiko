import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(
    `ALTER TABLE afip_emissions DROP CONSTRAINT IF EXISTS chk_afip_emissions_doc_type`,
  )
  await queryInterface.sequelize.query(
    `ALTER TABLE afip_emissions ADD CONSTRAINT chk_afip_emissions_doc_type
     CHECK (document_type IN ('invoice','credit_note','debit_note','sales_order'))`,
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(
    `ALTER TABLE afip_emissions DROP CONSTRAINT IF EXISTS chk_afip_emissions_doc_type`,
  )
  await queryInterface.sequelize.query(
    `ALTER TABLE afip_emissions ADD CONSTRAINT chk_afip_emissions_doc_type
     CHECK (document_type IN ('invoice','credit_note','debit_note'))`,
  )
}
