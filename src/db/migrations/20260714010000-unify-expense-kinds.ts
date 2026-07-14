import type { Migration } from '../../lib/migrations'

/**
 * Unify Expensas kinds:
 * - Rename recurring_expense_templates → expense_schedules
 * - expenses.recurring_template_id → schedule_id + kind
 * - New expense_installments for plan/cuotas
 */
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    -- Schedules (ex templates)
    ALTER TABLE recurring_expense_templates RENAME TO expense_schedules;

    ALTER INDEX IF EXISTS idx_recurring_expense_templates_org_branch
      RENAME TO idx_expense_schedules_org_branch;
    ALTER INDEX IF EXISTS idx_recurring_expense_templates_contact
      RENAME TO idx_expense_schedules_contact;
    ALTER INDEX IF EXISTS idx_recurring_expense_templates_due
      RENAME TO idx_expense_schedules_due;

    ALTER TABLE expense_schedules
      ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'recurring';

    ALTER TABLE expense_schedules
      ADD CONSTRAINT chk_expense_schedules_kind
      CHECK (kind IN ('recurring'));

    -- Expenses: kind + rename FK column
    ALTER TABLE expenses
      ADD COLUMN kind VARCHAR(30) NOT NULL DEFAULT 'one_off';

    ALTER TABLE expenses
      ADD CONSTRAINT chk_expenses_kind
      CHECK (kind IN ('one_off', 'recurring_occurrence', 'installment_plan'));

    ALTER TABLE expenses RENAME COLUMN recurring_template_id TO schedule_id;

    ALTER INDEX IF EXISTS idx_expenses_template RENAME TO idx_expenses_schedule;

    UPDATE expenses
       SET kind = 'recurring_occurrence'
     WHERE schedule_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_expenses_kind
      ON expenses(kind) WHERE deleted_at IS NULL;

    -- Installments (plans / cuotas)
    CREATE TYPE expense_installment_status AS ENUM ('pending', 'paid', 'cancelled');

    CREATE TABLE expense_installments (
      id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id              UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      expense_id          UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      installment_number  INTEGER       NOT NULL CHECK (installment_number >= 1),
      due_date            TIMESTAMPTZ   NOT NULL,
      amount              NUMERIC(15,2) NOT NULL CHECK (amount > 0),
      status              expense_installment_status NOT NULL DEFAULT 'pending',
      expense_payment_id  UUID          REFERENCES expense_payments(id) ON DELETE SET NULL,
      paid_at             TIMESTAMPTZ,
      created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at          TIMESTAMPTZ,
      created_by          UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by          UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by          UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT uq_expense_installments_number UNIQUE (expense_id, installment_number)
    );

    CREATE INDEX idx_expense_installments_expense
      ON expense_installments(expense_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_expense_installments_org
      ON expense_installments(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_expense_installments_due
      ON expense_installments(due_date)
      WHERE deleted_at IS NULL AND status = 'pending';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_expense_installments_due;
    DROP INDEX IF EXISTS idx_expense_installments_org;
    DROP INDEX IF EXISTS idx_expense_installments_expense;
    DROP TABLE IF EXISTS expense_installments;
    DROP TYPE IF EXISTS expense_installment_status;

    DROP INDEX IF EXISTS idx_expenses_kind;

    ALTER TABLE expenses DROP CONSTRAINT IF EXISTS chk_expenses_kind;
    ALTER TABLE expenses DROP COLUMN IF EXISTS kind;

    ALTER INDEX IF EXISTS idx_expenses_schedule RENAME TO idx_expenses_template;
    ALTER TABLE expenses RENAME COLUMN schedule_id TO recurring_template_id;

    ALTER TABLE expense_schedules DROP CONSTRAINT IF EXISTS chk_expense_schedules_kind;
    ALTER TABLE expense_schedules DROP COLUMN IF EXISTS kind;

    ALTER INDEX IF EXISTS idx_expense_schedules_due
      RENAME TO idx_recurring_expense_templates_due;
    ALTER INDEX IF EXISTS idx_expense_schedules_contact
      RENAME TO idx_recurring_expense_templates_contact;
    ALTER INDEX IF EXISTS idx_expense_schedules_org_branch
      RENAME TO idx_recurring_expense_templates_org_branch;

    ALTER TABLE expense_schedules RENAME TO recurring_expense_templates;
  `)
}
