import type { QueryInterface } from 'sequelize'
import { DataTypes } from 'sequelize'

export async function up({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.addColumn('organizations', 'gross_income', {
    type: DataTypes.STRING(32),
    allowNull: true,
  })
  await queryInterface.addColumn('organizations', 'activity_start_date', {
    type: DataTypes.DATEONLY,
    allowNull: true,
  })

  await queryInterface.addColumn('branches', 'establishment_code', {
    type: DataTypes.STRING(64),
    allowNull: true,
  })

  await queryInterface.addColumn('pos_devices', 'punto_venta', {
    type: DataTypes.SMALLINT,
    allowNull: true,
  })
  await queryInterface.sequelize.query(
    `ALTER TABLE pos_devices ADD CONSTRAINT chk_pos_devices_punto_venta
     CHECK (punto_venta IS NULL OR punto_venta > 0)`,
  )
}

export async function down({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.sequelize.query(
    'ALTER TABLE pos_devices DROP CONSTRAINT IF EXISTS chk_pos_devices_punto_venta',
  )
  await queryInterface.removeColumn('pos_devices', 'punto_venta')
  await queryInterface.removeColumn('branches', 'establishment_code')
  await queryInterface.removeColumn('organizations', 'activity_start_date')
  await queryInterface.removeColumn('organizations', 'gross_income')
}
