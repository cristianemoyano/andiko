import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE pos_payment_methods
      DROP CONSTRAINT uq_pos_payment_methods_org_name,
      ADD CONSTRAINT uq_pos_payment_methods_org_type UNIQUE (org_id, type);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE pos_payment_methods
      DROP CONSTRAINT uq_pos_payment_methods_org_type,
      ADD CONSTRAINT uq_pos_payment_methods_org_name UNIQUE (org_id, name);
  `)
}
