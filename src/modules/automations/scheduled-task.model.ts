import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export const SCHEDULE_KINDS = ['cron'] as const
export type ScheduleKind = typeof SCHEDULE_KINDS[number]

export const SCHEDULED_TASK_STATUSES = ['active', 'paused', 'disabled'] as const
export type ScheduledTaskStatus = typeof SCHEDULED_TASK_STATUSES[number]

export const SCHEDULED_TASK_RUN_STATUSES = ['success', 'failed', 'skipped'] as const
export type ScheduledTaskRunStatus = typeof SCHEDULED_TASK_RUN_STATUSES[number]

export interface ScheduledTaskAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID | null
  name: string
  description: string | null
  action_type: string
  payload: Record<string, unknown>
  schedule_kind: ScheduleKind
  cron_expression: string
  timezone: string
  status: ScheduledTaskStatus
  next_run_at: Date
  last_run_at: Date | null
  last_run_status: ScheduledTaskRunStatus | null
  claimed_at: Date | null
  claimed_by: string | null
  consecutive_failures: number
  max_consecutive_failures: number
  min_interval_seconds: number
}

type ScheduledTaskCreationAttributes = Optional<
  ScheduledTaskAttributes,
  | 'id' | 'org_id' | 'branch_id' | 'description' | 'payload' | 'schedule_kind' | 'timezone'
  | 'status' | 'last_run_at' | 'last_run_status' | 'claimed_at' | 'claimed_by'
  | 'consecutive_failures' | 'max_consecutive_failures' | 'min_interval_seconds'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class ScheduledTask extends AuditModel<ScheduledTaskAttributes, ScheduledTaskCreationAttributes> {
  declare id: UUID
  declare org_id: UUID | null
  declare branch_id: UUID | null
  declare name: string
  declare description: string | null
  declare action_type: string
  declare payload: Record<string, unknown>
  declare schedule_kind: ScheduleKind
  declare cron_expression: string
  declare timezone: string
  declare status: ScheduledTaskStatus
  declare next_run_at: Date
  declare last_run_at: Date | null
  declare last_run_status: ScheduledTaskRunStatus | null
  declare claimed_at: Date | null
  declare claimed_by: string | null
  declare consecutive_failures: number
  declare max_consecutive_failures: number
  declare min_interval_seconds: number
}

ScheduledTask.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    action_type: { type: DataTypes.STRING(64), allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    schedule_kind: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'cron' },
    cron_expression: { type: DataTypes.STRING(64), allowNull: false },
    timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'America/Argentina/Buenos_Aires' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    next_run_at: { type: DataTypes.DATE, allowNull: false },
    last_run_at: { type: DataTypes.DATE, allowNull: true },
    last_run_status: { type: DataTypes.STRING(16), allowNull: true },
    claimed_at: { type: DataTypes.DATE, allowNull: true },
    claimed_by: { type: DataTypes.STRING(64), allowNull: true },
    consecutive_failures: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_consecutive_failures: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    min_interval_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'scheduled_tasks', paranoid: true, underscored: true },
)

export default ScheduledTask
