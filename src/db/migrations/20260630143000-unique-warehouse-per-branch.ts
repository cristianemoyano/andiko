import type { Migration } from '../../lib/migrations'

/** Una sucursal → un depósito activo. Depósitos centrales dejan branch_id en NULL. */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouses_org_branch_active
      ON warehouses (org_id, branch_id)
      WHERE deleted_at IS NULL AND branch_id IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS uq_warehouses_org_branch_active;
  `)
}
