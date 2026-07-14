import type { Migration } from '../../lib/migrations'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    CREATE TABLE employees (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id               UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
      user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
      first_name              VARCHAR(100) NOT NULL,
      last_name               VARCHAR(100) NOT NULL,
      cuil                    VARCHAR(13),
      email                   VARCHAR(255),
      phone                   VARCHAR(50),
      position                VARCHAR(120),
      employment_type         VARCHAR(20) NOT NULL DEFAULT 'mensualizado'
                               CHECK (employment_type IN ('mensualizado', 'jornalizado', 'por_hora')),
      standard_weekly_minutes INTEGER CHECK (standard_weekly_minutes IS NULL OR standard_weekly_minutes > 0),
      hire_date               DATE NOT NULL,
      termination_date        DATE,
      external_employee_code  VARCHAR(32),
      is_active               BOOLEAN NOT NULL DEFAULT true,
      notes                   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      deleted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_employees_names_nonempty CHECK (length(trim(first_name)) > 0 AND length(trim(last_name)) > 0),
      CONSTRAINT chk_employees_termination_after_hire CHECK (termination_date IS NULL OR termination_date >= hire_date)
    );

    CREATE INDEX idx_employees_org ON employees(org_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_employees_org_branch ON employees(org_id, branch_id) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX uq_employees_user ON employees(user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;
    CREATE UNIQUE INDEX uq_employees_org_cuil ON employees(org_id, cuil) WHERE deleted_at IS NULL AND cuil IS NOT NULL;
    CREATE UNIQUE INDEX uq_employees_org_ext_code ON employees(org_id, external_employee_code) WHERE deleted_at IS NULL AND external_employee_code IS NOT NULL;
  `)
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS employees;
  `)
}
