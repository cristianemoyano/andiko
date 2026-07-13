import { DataTypes } from 'sequelize'
import type { Migration } from '@/lib/migrations'

const DEFAULT_ORG_TIMEZONE = 'America/Argentina/Buenos_Aires'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('organizations', 'timezone', {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: DEFAULT_ORG_TIMEZONE,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('organizations', 'timezone')
}
