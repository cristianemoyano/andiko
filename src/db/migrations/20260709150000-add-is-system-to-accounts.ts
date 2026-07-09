import type { Migration } from '../../lib/migrations'
import { DEFAULT_CHART_OF_ACCOUNTS } from '../../modules/accounting/default-chart'

const DEFAULT_CODES = DEFAULT_CHART_OF_ACCOUNTS.map(a => a.code)

export const up: Migration = async ({ context: queryInterface }) => {
  const sequelize = queryInterface.sequelize

  await sequelize.query(`
    ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await sequelize.query(
    `UPDATE accounts SET is_system = TRUE WHERE code IN (:codes)`,
    { replacements: { codes: DEFAULT_CODES } },
  )
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE accounts DROP COLUMN IF EXISTS is_system
  `)
}
