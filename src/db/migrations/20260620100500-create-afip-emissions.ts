import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('afip_emissions', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'organizations', key: 'id' } },
    document_type: { type: DataTypes.STRING(20), allowNull: false },
    document_id: { type: DataTypes.UUID, allowNull: false },
    cbte_tipo: { type: DataTypes.SMALLINT, allowNull: true },
    punto_venta: { type: DataTypes.SMALLINT, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
    request: { type: DataTypes.JSONB, allowNull: true },
    response: { type: DataTypes.JSONB, allowNull: true },
    observations: { type: DataTypes.JSONB, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    retries: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_attempt_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    deleted_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  })

  await queryInterface.sequelize.query(
    `ALTER TABLE afip_emissions ADD CONSTRAINT chk_afip_emissions_doc_type
     CHECK (document_type IN ('invoice','credit_note','debit_note'))`,
  )
  await queryInterface.sequelize.query(
    `ALTER TABLE afip_emissions ADD CONSTRAINT chk_afip_emissions_status
     CHECK (status IN ('pending','authorized','rejected','error'))`,
  )
  await queryInterface.addIndex('afip_emissions', ['org_id', 'document_type', 'document_id'], {
    name: 'idx_afip_emissions_document',
  })
  // Partial index to scan the contingency queue (pending/error) efficiently.
  await queryInterface.sequelize.query(
    `CREATE INDEX idx_afip_emissions_pending ON afip_emissions (org_id, status)
     WHERE status IN ('pending','error') AND deleted_at IS NULL`,
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('afip_emissions')
}
