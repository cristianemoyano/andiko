import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE product_category_status AS ENUM ('active', 'archived');

    CREATE TABLE product_categories (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
      parent_id   UUID REFERENCES product_categories(id) ON DELETE SET NULL,
      name        VARCHAR(100) NOT NULL,
      slug        VARCHAR(110) NOT NULL,
      description TEXT,
      status      product_category_status NOT NULL DEFAULT 'active',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID,
      updated_by  UUID,
      deleted_by  UUID,
      UNIQUE (slug, org_id)
    );

    CREATE INDEX idx_product_categories_org_id    ON product_categories(org_id)    WHERE deleted_at IS NULL;
    CREATE INDEX idx_product_categories_parent_id ON product_categories(parent_id) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS product_categories;
    DROP TYPE IF EXISTS product_category_status;
  `)
}
