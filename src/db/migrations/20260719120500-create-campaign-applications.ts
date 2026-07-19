import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE campaign_applications (
      id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                  UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      campaign_id             UUID          NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      coupon_id               UUID          REFERENCES coupons(id) ON DELETE SET NULL,
      document_type           VARCHAR(16)   NOT NULL,
      document_id             UUID          NOT NULL,
      applied_discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (applied_discount_amount >= 0),
      benefit_snapshot        TEXT,
      rule_snapshot           JSONB,
      applied_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      deleted_at              TIMESTAMPTZ,
      created_by              UUID          REFERENCES users(id) ON DELETE SET NULL,
      updated_by              UUID          REFERENCES users(id) ON DELETE SET NULL,
      deleted_by              UUID          REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_campaign_applications_doc_type CHECK (
        document_type IN ('sales_order', 'invoice', 'quote', 'pos_order')
      )
    );

    CREATE INDEX idx_campaign_applications_document ON campaign_applications(document_type, document_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_campaign_applications_campaign ON campaign_applications(campaign_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS idx_campaign_applications_campaign;
    DROP INDEX IF EXISTS idx_campaign_applications_document;
    DROP TABLE IF EXISTS campaign_applications;
  `)
}
