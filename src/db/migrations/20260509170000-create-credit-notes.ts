import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('credit_notes', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'organizations', key: 'id' },
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
    },
    contact_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'contacts', key: 'id' },
    },
    invoice_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'invoices', key: 'id' },
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    deleted_by: { type: DataTypes.UUID, allowNull: true },
    credit_note_number: { type: DataTypes.STRING(50), allowNull: false },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
    },
    issue_date: { type: DataTypes.DATEONLY, allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'ARS' },
    subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    applied_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    remaining: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    reason: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  })

  await queryInterface.sequelize.query(
    `ALTER TABLE credit_notes ADD CONSTRAINT chk_credit_notes_status CHECK (status IN ('draft','issued','cancelled'))`,
  )
  await queryInterface.sequelize.query(
    `ALTER TABLE credit_notes ADD CONSTRAINT chk_credit_notes_total CHECK (total >= 0)`,
  )
  await queryInterface.addIndex('credit_notes', ['org_id'], { name: 'idx_credit_notes_org_id' })
  await queryInterface.addIndex('credit_notes', ['invoice_id'], { name: 'idx_credit_notes_invoice_id' })
  await queryInterface.addIndex('credit_notes', ['contact_id'], { name: 'idx_credit_notes_contact_id' })
  await queryInterface.addIndex('credit_notes', ['branch_id'], { name: 'idx_credit_notes_branch_id' })
  await queryInterface.addIndex('credit_notes', ['deleted_at'], { name: 'idx_credit_notes_deleted_at' })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('credit_notes')
}
