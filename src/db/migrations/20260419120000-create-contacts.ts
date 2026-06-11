import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TYPE contact_type AS ENUM ('customer', 'supplier', 'both');
    CREATE TYPE iva_condition AS ENUM (
      'responsable_inscripto',
      'monotributista',
      'consumidor_final',
      'exento',
      'no_responsable'
    );
    CREATE TYPE address_type AS ENUM ('fiscal', 'delivery', 'commercial');

    CREATE TABLE contacts (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type         contact_type NOT NULL,
      legal_name   VARCHAR(255) NOT NULL,
      trade_name   VARCHAR(255),
      cuit         VARCHAR(13) UNIQUE,
      iva_condition iva_condition NOT NULL,
      email        VARCHAR(255),
      phone        VARCHAR(50),
      notes        TEXT,
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    );

    CREATE INDEX idx_contacts_cuit ON contacts (cuit) WHERE deleted_at IS NULL;
    CREATE INDEX idx_contacts_type ON contacts (type) WHERE deleted_at IS NULL;
    CREATE INDEX idx_contacts_legal_name ON contacts (legal_name) WHERE deleted_at IS NULL;

    CREATE TABLE contact_addresses (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id   UUID NOT NULL REFERENCES contacts(id),
      type         address_type NOT NULL,
      street       VARCHAR(255) NOT NULL,
      number       VARCHAR(20),
      floor        VARCHAR(20),
      apartment    VARCHAR(20),
      city         VARCHAR(100) NOT NULL,
      province     VARCHAR(100) NOT NULL,
      postal_code  VARCHAR(10),
      country      VARCHAR(100) NOT NULL DEFAULT 'Argentina',
      is_default   BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    );

    CREATE INDEX idx_contact_addresses_contact_id ON contact_addresses (contact_id);

    CREATE TABLE contact_payment_info (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id   UUID NOT NULL REFERENCES contacts(id),
      bank_name    VARCHAR(100),
      cbu          VARCHAR(22) UNIQUE,
      alias        VARCHAR(100),
      account_type VARCHAR(20) CHECK (account_type IN ('checking', 'savings')),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    );

    CREATE INDEX idx_contact_payment_info_contact_id ON contact_payment_info (contact_id);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS contact_payment_info;
    DROP TABLE IF EXISTS contact_addresses;
    DROP TABLE IF EXISTS contacts;
    DROP TYPE IF EXISTS address_type;
    DROP TYPE IF EXISTS iva_condition;
    DROP TYPE IF EXISTS contact_type;
  `)
}
