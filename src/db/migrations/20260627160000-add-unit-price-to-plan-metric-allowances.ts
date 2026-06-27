import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE billing_plan_metric_allowances
      ADD COLUMN unit_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0);

    UPDATE billing_plan_metric_allowances a
    SET unit_price = COALESCE(
      (
        SELECT m.unit_price
        FROM billing_metrics m
        WHERE m.key = a.metric_key
          AND m.deleted_at IS NULL
        LIMIT 1
      ),
      0
    );
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE billing_plan_metric_allowances
      DROP COLUMN IF EXISTS unit_price;
  `)
}
