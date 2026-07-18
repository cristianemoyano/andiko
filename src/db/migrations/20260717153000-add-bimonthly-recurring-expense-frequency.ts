import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TYPE recurring_expense_frequency ADD VALUE IF NOT EXISTS 'bimonthly';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE expense_schedules
      ALTER COLUMN frequency DROP DEFAULT;

    CREATE TYPE recurring_expense_frequency_old AS ENUM ('monthly', 'weekly');

    ALTER TABLE expense_schedules
      ALTER COLUMN frequency TYPE recurring_expense_frequency_old
      USING (
        CASE
          WHEN frequency::text = 'bimonthly' THEN 'monthly'
          ELSE frequency::text
        END
      )::recurring_expense_frequency_old;

    DROP TYPE recurring_expense_frequency;
    ALTER TYPE recurring_expense_frequency_old RENAME TO recurring_expense_frequency;

    ALTER TABLE expense_schedules
      ALTER COLUMN frequency SET DEFAULT 'monthly';
  `)
}
