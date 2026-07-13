import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export type AttendanceEventType = 'clock_in' | 'clock_out' | 'absence'
export type AttendanceEventSource = 'self_service' | 'manual' | 'device_import'

export interface AttendanceEventAttributes extends Timestamps, AuditFields {
  id: UUID
  branch_id: UUID
  employee_id: UUID
  event_type: AttendanceEventType
  occurred_at: Date
  work_date: Date | string
  source: AttendanceEventSource
  note: string | null
  corrects_event_id: UUID | null
}

type AttendanceEventCreationAttributes = Optional<
  AttendanceEventAttributes,
  'id' | 'note' | 'corrects_event_id' |
  'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class AttendanceEvent extends AuditModel<AttendanceEventAttributes, AttendanceEventCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID
  declare employee_id: UUID
  declare event_type: AttendanceEventType
  declare occurred_at: Date
  declare work_date: Date | string
  declare source: AttendanceEventSource
  declare note: string | null
  declare corrects_event_id: UUID | null
}

AttendanceEvent.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:         { type: DataTypes.UUID, allowNull: false },
    employee_id:       { type: DataTypes.UUID, allowNull: false },
    event_type:        { type: DataTypes.STRING(20), allowNull: false },
    occurred_at:       { type: DataTypes.DATE, allowNull: false },
    work_date:         { type: DataTypes.DATEONLY, allowNull: false },
    source:            { type: DataTypes.STRING(20), allowNull: false },
    note:              { type: DataTypes.TEXT },
    corrects_event_id: { type: DataTypes.UUID },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'attendance_events', paranoid: true, underscored: true }
)

export default AttendanceEvent
