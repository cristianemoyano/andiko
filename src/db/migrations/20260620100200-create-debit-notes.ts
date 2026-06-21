import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('debit_notes', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'organizations', key: 'id' } },
    branch_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'branches', key: 'id' } },
    contact_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'contacts', key: 'id' } },
    invoice_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'invoices', key: 'id' } },
    created_by: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    deleted_by: { type: DataTypes.UUID, allowNull: true },
    debit_note_number: { type: DataTypes.STRING(50), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    issue_date: { type: DataTypes.DATEONLY, allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    reason: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    cae: { type: DataTypes.STRING(14), allowNull: true },
    cae_expiration: { type: DataTypes.DATEONLY, allowNull: true },
    comprobante_tipo: { type: DataTypes.SMALLINT, allowNull: true },
    punto_venta: { type: DataTypes.SMALLINT, allowNull: true },
    cbte_numero: { type: DataTypes.INTEGER, allowNull: true },
    afip_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'not_sent' },
    afip_observations: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  })

  await queryInterface.sequelize.query(
    `ALTER TABLE debit_notes ADD CONSTRAINT chk_debit_notes_status CHECK (status IN ('draft','issued','cancelled'))`,
  )
  await queryInterface.sequelize.query(
    `ALTER TABLE debit_notes ADD CONSTRAINT chk_debit_notes_total CHECK (total >= 0)`,
  )
  await queryInterface.sequelize.query(
    `ALTER TABLE debit_notes ADD CONSTRAINT chk_debit_notes_afip_status
     CHECK (afip_status IN ('not_sent','pending','authorized','rejected','contingency'))`,
  )
  await queryInterface.addIndex('debit_notes', ['org_id'], { name: 'idx_debit_notes_org_id' })
  await queryInterface.addIndex('debit_notes', ['invoice_id'], { name: 'idx_debit_notes_invoice_id' })
  await queryInterface.addIndex('debit_notes', ['contact_id'], { name: 'idx_debit_notes_contact_id' })
  await queryInterface.addIndex('debit_notes', ['branch_id'], { name: 'idx_debit_notes_branch_id' })
  await queryInterface.addIndex('debit_notes', ['deleted_at'], { name: 'idx_debit_notes_deleted_at' })
  await queryInterface.sequelize.query(
    `CREATE UNIQUE INDEX uq_debit_notes_afip_cbte
     ON debit_notes (org_id, punto_venta, comprobante_tipo, cbte_numero)
     WHERE cae IS NOT NULL AND deleted_at IS NULL`,
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('debit_notes')
}
