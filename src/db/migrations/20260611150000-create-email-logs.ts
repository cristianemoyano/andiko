import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('email_logs', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'organizations', key: 'id' },
    },
    // Document this email refers to. Domain/type are free-form module identifiers
    // (e.g. 'sales' / 'quote'); document_id is the referenced record's UUID.
    document_domain: { type: DataTypes.STRING(32), allowNull: false },
    document_type: { type: DataTypes.STRING(32), allowNull: false },
    document_id: { type: DataTypes.UUID, allowNull: false },
    recipient: { type: DataTypes.STRING(320), allowNull: false },
    subject: { type: DataTypes.STRING(500), allowNull: false },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'sent',
    },
    error: { type: DataTypes.TEXT, allowNull: true },
    sent_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  })

  await queryInterface.addConstraint('email_logs', {
    type: 'check',
    fields: ['status'],
    name: 'chk_email_logs_status',
    where: { status: ['sent', 'failed'] },
  })

  await queryInterface.addIndex('email_logs', ['org_id'], {
    name: 'idx_email_logs_org_id',
  })
  await queryInterface.addIndex('email_logs', ['org_id', 'document_domain', 'document_type', 'document_id'], {
    name: 'idx_email_logs_org_document',
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('email_logs')
}
