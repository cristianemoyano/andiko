import { DataTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  // Per-site monetization: bill per connected WooCommerce store, mirroring the
  // seats/branches model (included quantity + per-unit overage).
  await queryInterface.sequelize.query(`
    ALTER TABLE billing_plans
      ADD COLUMN included_sites INTEGER NOT NULL DEFAULT 0 CHECK (included_sites >= 0),
      ADD COLUMN per_site_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (per_site_price >= 0);

    ALTER TYPE billing_line_kind ADD VALUE IF NOT EXISTS 'site';
  `)

  // Snapshot of active site count billed in a given period.
  await queryInterface.addColumn('billing_invoices', 'billed_sites', {
    type: DataTypes.INTEGER,
    allowNull: true,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('billing_invoices', 'billed_sites')
  await queryInterface.sequelize.query(`
    ALTER TABLE billing_plans
      DROP COLUMN IF EXISTS included_sites,
      DROP COLUMN IF EXISTS per_site_price;
  `)
}
