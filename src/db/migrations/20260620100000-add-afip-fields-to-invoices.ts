import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

const AFIP_COLUMNS = {
  cae: { type: DataTypes.STRING(14), allowNull: true },
  cae_expiration: { type: DataTypes.DATEONLY, allowNull: true },
  comprobante_tipo: { type: DataTypes.SMALLINT, allowNull: true },
  punto_venta: { type: DataTypes.SMALLINT, allowNull: true },
  cbte_numero: { type: DataTypes.INTEGER, allowNull: true },
  afip_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'not_sent' },
  afip_observations: { type: DataTypes.JSONB, allowNull: true },
} as const

export const up: Migration = async ({ context: queryInterface }) => {
  for (const [name, def] of Object.entries(AFIP_COLUMNS)) {
    await queryInterface.addColumn('invoices', name, def)
  }
  await queryInterface.sequelize.query(
    `ALTER TABLE invoices ADD CONSTRAINT chk_invoices_afip_status
     CHECK (afip_status IN ('not_sent','pending','authorized','rejected','contingency'))`,
  )
  // One authorized fiscal number per (org, punto de venta, comprobante tipo).
  await queryInterface.sequelize.query(
    `CREATE UNIQUE INDEX uq_invoices_afip_cbte
     ON invoices (org_id, punto_venta, comprobante_tipo, cbte_numero)
     WHERE cae IS NOT NULL AND deleted_at IS NULL`,
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_invoices_afip_cbte')
  await queryInterface.sequelize.query('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoices_afip_status')
  for (const name of Object.keys(AFIP_COLUMNS)) {
    await queryInterface.removeColumn('invoices', name)
  }
}
