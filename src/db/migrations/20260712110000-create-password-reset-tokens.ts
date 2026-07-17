import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

// Ephemeral security tokens — intentionally no soft-delete (same criteria as
// auth_throttles): a row is either consumed (used_at) or expired (expires_at),
// not a business record.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('password_reset_tokens', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    // sha256 hex digest of the raw token — never store the raw token itself.
    token_hash: { type: DataTypes.STRING(64), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  })

  await queryInterface.addIndex('password_reset_tokens', ['token_hash'], {
    unique: true,
    name: 'uq_password_reset_tokens_token_hash',
  })
  await queryInterface.addIndex('password_reset_tokens', ['user_id'], {
    name: 'idx_password_reset_tokens_user_id',
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('password_reset_tokens')
}
