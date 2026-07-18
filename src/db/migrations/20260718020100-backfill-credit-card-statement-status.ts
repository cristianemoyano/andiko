import type { Migration } from '../../lib/migrations'

/**
 * Statements created before status sync existed can disagree with their linked
 * expense (e.g. cancelled expense, statement still 'received'). Mirror status,
 * paid_amount and balance from the payable so the partial unique index frees
 * cancelled periods.
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    UPDATE credit_card_statements s
    SET status      = e.status::text::credit_card_statement_status,
        paid_amount = e.paid_amount,
        balance     = e.balance,
        updated_at  = NOW()
    FROM expenses e
    WHERE s.expense_id = e.id
      AND s.deleted_at IS NULL
      AND s.status::text IS DISTINCT FROM e.status::text;
  `)
}

export const down: Migration = async () => {
  // Data backfill — nothing to revert.
}
