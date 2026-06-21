import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('branches', 'punto_venta', {
    type: DataTypes.SMALLINT,
    allowNull: true,
  })
  await queryInterface.sequelize.query(
    `ALTER TABLE branches ADD CONSTRAINT chk_branches_punto_venta
     CHECK (punto_venta IS NULL OR punto_venta > 0)`,
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query('ALTER TABLE branches DROP CONSTRAINT IF EXISTS chk_branches_punto_venta')
  await queryInterface.removeColumn('branches', 'punto_venta')
}
