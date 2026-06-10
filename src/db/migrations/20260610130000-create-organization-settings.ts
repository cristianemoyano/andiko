import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('organization_settings', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'organizations', key: 'id' },
    },
    enabled_modules: { type: DataTypes.JSONB, allowNull: true },
    enabled_features: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE },
  })
  await queryInterface.addIndex('organization_settings', ['org_id'], {
    name: 'idx_organization_settings_org_id_unique',
    unique: true,
    where: { deleted_at: null },
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('organization_settings')
}
