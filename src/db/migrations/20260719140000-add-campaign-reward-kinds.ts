import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(15,2) CHECK (reward_amount >= 0);
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS buy_qty NUMERIC(15,4) CHECK (buy_qty > 0);
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS get_qty NUMERIC(15,4) CHECK (get_qty > 0);

    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS chk_campaigns_reward_kind;
    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS chk_campaigns_reward_integrity;

    ALTER TABLE campaigns ADD CONSTRAINT chk_campaigns_reward_kind
      CHECK (reward_kind IN ('percent', 'installments', 'fixed_amount', 'free_qty'));

    ALTER TABLE campaigns ADD CONSTRAINT chk_campaigns_reward_integrity CHECK (
      (reward_kind = 'percent'      AND reward_percent IS NOT NULL) OR
      (reward_kind = 'installments' AND installments_count IS NOT NULL) OR
      (reward_kind = 'fixed_amount' AND reward_amount IS NOT NULL) OR
      (reward_kind = 'free_qty'     AND buy_qty IS NOT NULL AND get_qty IS NOT NULL)
    );
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DELETE FROM campaigns WHERE reward_kind IN ('fixed_amount', 'free_qty');

    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS chk_campaigns_reward_kind;
    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS chk_campaigns_reward_integrity;

    ALTER TABLE campaigns ADD CONSTRAINT chk_campaigns_reward_kind
      CHECK (reward_kind IN ('percent', 'installments'));

    ALTER TABLE campaigns ADD CONSTRAINT chk_campaigns_reward_integrity CHECK (
      (reward_kind = 'percent'      AND reward_percent IS NOT NULL) OR
      (reward_kind = 'installments' AND installments_count IS NOT NULL)
    );

    ALTER TABLE campaigns DROP COLUMN IF EXISTS get_qty;
    ALTER TABLE campaigns DROP COLUMN IF EXISTS buy_qty;
    ALTER TABLE campaigns DROP COLUMN IF EXISTS reward_amount;
  `)
}
