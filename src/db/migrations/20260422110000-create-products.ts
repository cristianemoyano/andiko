import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE product_type AS ENUM ('simple', 'service');
    CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
    CREATE TYPE iva_rate AS ENUM ('0', '10.5', '21', '27');
    CREATE TYPE unit_of_measure AS ENUM (
      'unidad', 'kg', 'g', 'litro', 'ml',
      'metro', 'cm', 'm2', 'm3',
      'hora', 'caja', 'paquete', 'docena', 'par', 'rollo'
    );

    CREATE TABLE products (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id            UUID REFERENCES organizations(id) ON DELETE SET NULL,
      category_id       UUID REFERENCES product_categories(id) ON DELETE SET NULL,
      name              VARCHAR(255) NOT NULL,
      slug              VARCHAR(265) NOT NULL,
      description       TEXT,
      short_description VARCHAR(500),
      product_type      product_type NOT NULL DEFAULT 'simple',
      status            product_status NOT NULL DEFAULT 'draft',
      vendor            VARCHAR(255),
      iva_rate          iva_rate NOT NULL DEFAULT '21',
      unit_of_measure   unit_of_measure NOT NULL DEFAULT 'unidad',
      ncm_code          VARCHAR(8),
      tags              JSONB NOT NULL DEFAULT '[]',
      images            JSONB NOT NULL DEFAULT '[]',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at        TIMESTAMPTZ,
      created_by        UUID,
      updated_by        UUID,
      deleted_by        UUID,
      UNIQUE (slug, org_id)
    );

    CREATE INDEX idx_products_org_id   ON products(org_id)      WHERE deleted_at IS NULL;
    CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_products_status   ON products(status)      WHERE deleted_at IS NULL;
    CREATE INDEX idx_products_name_fts ON products USING gin(to_tsvector('spanish', name)) WHERE deleted_at IS NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS products;
    DROP TYPE IF EXISTS product_type;
    DROP TYPE IF EXISTS product_status;
    DROP TYPE IF EXISTS iva_rate;
    DROP TYPE IF EXISTS unit_of_measure;
  `)
}
