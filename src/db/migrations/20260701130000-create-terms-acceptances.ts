import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('terms_acceptances', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
    terms_version: { type: DataTypes.STRING(20), allowNull: false },
    accepted_at: { type: DataTypes.DATE, allowNull: false },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    user_agent: { type: DataTypes.STRING(500), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  })

  await queryInterface.addIndex('terms_acceptances', ['user_id'], { name: 'idx_terms_acceptances_user_id' })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('terms_acceptances')
}
