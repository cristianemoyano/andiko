import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE billing_plans
      ADD COLUMN included_branches INTEGER NOT NULL DEFAULT 1 CHECK (included_branches >= 0),
      ADD COLUMN per_branch_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (per_branch_price >= 0);

    ALTER TYPE billing_line_kind ADD VALUE IF NOT EXISTS 'branch';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE billing_plans
      DROP COLUMN IF EXISTS included_branches,
      DROP COLUMN IF EXISTS per_branch_price;
  `)
}
