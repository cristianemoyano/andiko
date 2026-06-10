import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('organizations', 'legal_name', {
    type: DataTypes.STRING(255),
    allowNull: true,
  })
  await queryInterface.addColumn('organizations', 'cuit', {
    type: DataTypes.STRING(13),
    allowNull: true,
  })
  await queryInterface.addColumn('organizations', 'iva_condition', {
    type: DataTypes.STRING(30),
    allowNull: true,
  })
  await queryInterface.addColumn('organizations', 'fiscal_address', {
    type: DataTypes.STRING(500),
    allowNull: true,
  })
  await queryInterface.sequelize.query(
    `ALTER TABLE organizations ADD CONSTRAINT chk_organizations_iva_condition
     CHECK (iva_condition IS NULL OR iva_condition IN ('responsable_inscripto', 'monotributista', 'consumidor_final', 'exento', 'no_responsable'))`,
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(
    'ALTER TABLE organizations DROP CONSTRAINT IF EXISTS chk_organizations_iva_condition',
  )
  await queryInterface.removeColumn('organizations', 'fiscal_address')
  await queryInterface.removeColumn('organizations', 'iva_condition')
  await queryInterface.removeColumn('organizations', 'cuit')
  await queryInterface.removeColumn('organizations', 'legal_name')
}
