import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sys-admin' BEFORE 'admin';
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  // PostgreSQL does not support removing enum values without recreating the type.
  // To roll back, recreate the type without 'sys-admin' and migrate the column.
  await queryInterface.sequelize.query(`
    UPDATE users SET role = 'admin' WHERE role = 'sys-admin';

    ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50);
    DROP TYPE user_role;
    CREATE TYPE user_role AS ENUM ('admin', 'operator', 'readonly');
    ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;

    ALTER TABLE role_permissions ALTER COLUMN role TYPE VARCHAR(50);
    ALTER TABLE role_permissions ALTER COLUMN role TYPE user_role USING role::user_role;
  `)
}
