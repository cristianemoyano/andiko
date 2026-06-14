import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('email_logs', 'body_text', {
    type: DataTypes.TEXT,
    allowNull: true,
  })
  await queryInterface.addColumn('email_logs', 'body_html', {
    type: DataTypes.TEXT,
    allowNull: true,
  })
  await queryInterface.addColumn('email_logs', 'transport', {
    type: DataTypes.STRING(8),
    allowNull: true,
  })
  await queryInterface.addColumn('email_logs', 'message_id', {
    type: DataTypes.STRING(255),
    allowNull: true,
  })

  await queryInterface.addConstraint('email_logs', {
    type: 'check',
    fields: ['transport'],
    name: 'chk_email_logs_transport',
    where: { transport: ['smtp', 'log'] },
  })

  await queryInterface.addIndex('email_logs', ['org_id', 'created_at'], {
    name: 'idx_email_logs_org_created_at',
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeIndex('email_logs', 'idx_email_logs_org_created_at')
  await queryInterface.removeConstraint('email_logs', 'chk_email_logs_transport')
  await queryInterface.removeColumn('email_logs', 'message_id')
  await queryInterface.removeColumn('email_logs', 'transport')
  await queryInterface.removeColumn('email_logs', 'body_html')
  await queryInterface.removeColumn('email_logs', 'body_text')
}
