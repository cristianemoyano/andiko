import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('afip_auth_tokens', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'organizations', key: 'id' } },
    service: { type: DataTypes.STRING(20), allowNull: false },
    token: { type: DataTypes.TEXT, allowNull: false },
    sign: { type: DataTypes.TEXT, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    deleted_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  })
  await queryInterface.addIndex('afip_auth_tokens', ['org_id', 'service'], {
    name: 'idx_afip_auth_tokens_org_service',
  })
  await queryInterface.addIndex('afip_auth_tokens', ['deleted_at'], {
    name: 'idx_afip_auth_tokens_deleted_at',
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('afip_auth_tokens')
}
