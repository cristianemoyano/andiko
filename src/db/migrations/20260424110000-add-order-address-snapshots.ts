import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE sales_orders
      ADD COLUMN IF NOT EXISTS shipping_street VARCHAR(255),
      ADD COLUMN IF NOT EXISTS shipping_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS shipping_floor VARCHAR(20),
      ADD COLUMN IF NOT EXISTS shipping_apartment VARCHAR(20),
      ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS shipping_province VARCHAR(100),
      ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100),
      ADD COLUMN IF NOT EXISTS billing_street VARCHAR(255),
      ADD COLUMN IF NOT EXISTS billing_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS billing_floor VARCHAR(20),
      ADD COLUMN IF NOT EXISTS billing_apartment VARCHAR(20),
      ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS billing_province VARCHAR(100),
      ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100);
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TABLE sales_orders
      DROP COLUMN IF EXISTS billing_country,
      DROP COLUMN IF EXISTS billing_postal_code,
      DROP COLUMN IF EXISTS billing_province,
      DROP COLUMN IF EXISTS billing_city,
      DROP COLUMN IF EXISTS billing_apartment,
      DROP COLUMN IF EXISTS billing_floor,
      DROP COLUMN IF EXISTS billing_number,
      DROP COLUMN IF EXISTS billing_street,
      DROP COLUMN IF EXISTS shipping_country,
      DROP COLUMN IF EXISTS shipping_postal_code,
      DROP COLUMN IF EXISTS shipping_province,
      DROP COLUMN IF EXISTS shipping_city,
      DROP COLUMN IF EXISTS shipping_apartment,
      DROP COLUMN IF EXISTS shipping_floor,
      DROP COLUMN IF EXISTS shipping_number,
      DROP COLUMN IF EXISTS shipping_street;
  `)
}
