import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE user_branches (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX idx_user_branches_user_branch_active
      ON user_branches (user_id, branch_id)
      WHERE deleted_at IS NULL;

    CREATE INDEX idx_user_branches_user_id ON user_branches(user_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_user_branches_branch_id ON user_branches(branch_id) WHERE deleted_at IS NULL;

    INSERT INTO user_branches (user_id, branch_id, created_at, updated_at)
    SELECT u.id, u.branch_id, NOW(), NOW()
    FROM users u
    WHERE u.branch_id IS NOT NULL
      AND u.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM branches b WHERE b.id = u.branch_id AND b.deleted_at IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM user_branches ub
        WHERE ub.user_id = u.id AND ub.branch_id = u.branch_id AND ub.deleted_at IS NULL
      );
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS user_branches;
  `)
}
