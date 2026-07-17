import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE accounting_periods (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      start_date        DATE NOT NULL,
      end_date          DATE NOT NULL,
      status            VARCHAR(20) NOT NULL DEFAULT 'closed' CHECK (status IN ('closed', 'reopened')),
      closing_entry_id  UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
      reversal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at        TIMESTAMPTZ,
      created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by        UUID REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_accounting_periods_range CHECK (start_date <= end_date)
    );

    CREATE INDEX idx_accounting_periods_org_id ON accounting_periods(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_accounting_periods_org_closed ON accounting_periods(org_id, end_date)
      WHERE deleted_at IS NULL AND status = 'closed';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS accounting_periods;
  `)
}
