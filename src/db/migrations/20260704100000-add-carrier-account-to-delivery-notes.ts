import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE delivery_notes
      ADD COLUMN carrier_account_id UUID REFERENCES carrier_accounts(id) ON DELETE RESTRICT;

    CREATE INDEX idx_delivery_notes_carrier
      ON delivery_notes(carrier_account_id)
      WHERE carrier_account_id IS NOT NULL AND deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_delivery_notes_carrier;
    ALTER TABLE delivery_notes DROP COLUMN IF EXISTS carrier_account_id;
  `)
}
