import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export type EmploymentType = 'mensualizado' | 'jornalizado' | 'por_hora'

export interface EmployeeAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID
  user_id: UUID | null
  first_name: string
  last_name: string
  cuil: string | null
  email: string | null
  phone: string | null
  position: string | null
  employment_type: EmploymentType
  standard_weekly_minutes: number | null
  hire_date: Date | string
  termination_date: Date | string | null
  external_employee_code: string | null
  is_active: boolean
  notes: string | null
}

type EmployeeCreationAttributes = Optional<
  EmployeeAttributes,
  'id' | 'user_id' | 'cuil' | 'email' | 'phone' | 'position' | 'employment_type' |
  'standard_weekly_minutes' | 'termination_date' | 'external_employee_code' | 'is_active' | 'notes' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class Employee extends AuditModel<EmployeeAttributes, EmployeeCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID
  declare user_id: UUID | null
  declare first_name: string
  declare last_name: string
  declare cuil: string | null
  declare email: string | null
  declare phone: string | null
  declare position: string | null
  declare employment_type: EmploymentType
  declare standard_weekly_minutes: number | null
  declare hire_date: Date | string
  declare termination_date: Date | string | null
  declare external_employee_code: string | null
  declare is_active: boolean
  declare notes: string | null
}

Employee.init(
  {
    id:                      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:               { type: DataTypes.UUID, allowNull: false },
    user_id:                 { type: DataTypes.UUID },
    first_name:              { type: DataTypes.STRING(100), allowNull: false },
    last_name:               { type: DataTypes.STRING(100), allowNull: false },
    cuil:                    { type: DataTypes.STRING(13) },
    email:                   { type: DataTypes.STRING(255) },
    phone:                   { type: DataTypes.STRING(50) },
    position:                { type: DataTypes.STRING(120) },
    employment_type:         { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'mensualizado' },
    standard_weekly_minutes: { type: DataTypes.INTEGER },
    hire_date:               { type: DataTypes.DATEONLY, allowNull: false },
    termination_date:        { type: DataTypes.DATEONLY },
    external_employee_code:  { type: DataTypes.STRING(32) },
    is_active:               { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notes:                   { type: DataTypes.TEXT },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'employees', paranoid: true, underscored: true }
)

export default Employee
