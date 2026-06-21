import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('afip_credentials', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'organizations', key: 'id' } },
    environment: { type: DataTypes.STRING(20), allowNull: false },
    cuit: { type: DataTypes.STRING(13), allowNull: false },
    cert_pem: { type: DataTypes.TEXT, allowNull: false },
    key_encrypted: { type: DataTypes.TEXT, allowNull: false },
    label: { type: DataTypes.STRING(120), allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    deleted_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  })

  await queryInterface.sequelize.query(
    `ALTER TABLE afip_credentials ADD CONSTRAINT chk_afip_credentials_environment
     CHECK (environment IN ('homologacion','produccion'))`,
  )
  await queryInterface.addIndex('afip_credentials', ['org_id'], { name: 'idx_afip_credentials_org_id' })
  await queryInterface.addIndex('afip_credentials', ['deleted_at'], { name: 'idx_afip_credentials_deleted_at' })
  // One active credential per org + environment.
  await queryInterface.sequelize.query(
    `CREATE UNIQUE INDEX uq_afip_credentials_active
     ON afip_credentials (org_id, environment)
     WHERE is_active AND deleted_at IS NULL`,
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('afip_credentials')
}
