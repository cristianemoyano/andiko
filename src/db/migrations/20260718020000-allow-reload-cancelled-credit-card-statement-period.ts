import type { Migration } from '../../lib/migrations'

/**
 * A cancelled statement must free its period so the month can be re-entered
 * after a data-entry mistake. Replace the plain UNIQUE constraint with a
 * partial unique index that ignores cancelled and soft-deleted rows.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE credit_card_statements
      DROP CONSTRAINT uq_credit_card_statements_period;

    CREATE UNIQUE INDEX uq_credit_card_statements_period
      ON credit_card_statements(credit_card_id, period_label)
      WHERE deleted_at IS NULL AND status <> 'cancelled';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS uq_credit_card_statements_period;

    ALTER TABLE credit_card_statements
      ADD CONSTRAINT uq_credit_card_statements_period
      UNIQUE (credit_card_id, period_label);
  `)
}
