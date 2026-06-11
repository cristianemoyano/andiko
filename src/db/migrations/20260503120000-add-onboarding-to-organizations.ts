import type { Migration } from '../../lib/migrations'
import { DataTypes } from 'sequelize'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('organizations', 'onboarding_completed_at', {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  })

  await queryInterface.addColumn('organizations', 'onboarding_data', {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null,
  })

  await queryInterface.addIndex('organizations', ['onboarding_completed_at'], {
    name: 'idx_organizations_onboarding_completed_at',
    where: { deleted_at: null } as Record<string, unknown>,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeIndex('organizations', 'idx_organizations_onboarding_completed_at')
  await queryInterface.removeColumn('organizations', 'onboarding_data')
  await queryInterface.removeColumn('organizations', 'onboarding_completed_at')
}
