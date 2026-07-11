import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import ScheduledTask from './scheduled-task.model'

export const SCHEDULED_TASK_RUN_TRIGGER_KINDS = ['scheduled', 'manual'] as const
export type ScheduledTaskRunTriggerKind = typeof SCHEDULED_TASK_RUN_TRIGGER_KINDS[number]

export const SCHEDULED_TASK_RUN_LOG_STATUSES = ['running', 'success', 'failed', 'skipped'] as const
export type ScheduledTaskRunLogStatus = typeof SCHEDULED_TASK_RUN_LOG_STATUSES[number]

export interface ScheduledTaskRunAttributes {
  id: UUID
  scheduled_task_id: UUID
  org_id: UUID
  status: ScheduledTaskRunLogStatus
  trigger_kind: ScheduledTaskRunTriggerKind
  started_at: Date
  finished_at: Date | null
  duration_ms: number | null
  result: Record<string, unknown> | null
  error: string | null
  created_at: Date
  updated_at: Date
}

type ScheduledTaskRunCreationAttributes = Optional<
  ScheduledTaskRunAttributes,
  'id' | 'status' | 'trigger_kind' | 'started_at' | 'finished_at' | 'duration_ms' | 'result' | 'error'
  | 'created_at' | 'updated_at'
>

export class ScheduledTaskRun extends Model<ScheduledTaskRunAttributes, ScheduledTaskRunCreationAttributes> {
  declare id: UUID
  declare scheduled_task_id: UUID
  declare org_id: UUID
  declare status: ScheduledTaskRunLogStatus
  declare trigger_kind: ScheduledTaskRunTriggerKind
  declare started_at: Date
  declare finished_at: Date | null
  declare duration_ms: number | null
  declare result: Record<string, unknown> | null
  declare error: string | null
  declare created_at: Date
  declare updated_at: Date
}

ScheduledTaskRun.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    scheduled_task_id: { type: DataTypes.UUID, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'running' },
    trigger_kind: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'scheduled' },
    started_at: { type: DataTypes.DATE, allowNull: false },
    finished_at: { type: DataTypes.DATE, allowNull: true },
    duration_ms: { type: DataTypes.INTEGER, allowNull: true },
    result: { type: DataTypes.JSONB, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'scheduled_task_runs',
    paranoid: false,
    underscored: true,
  },
)

if (!ScheduledTask.associations.runs) {
  ScheduledTask.hasMany(ScheduledTaskRun, { as: 'runs', foreignKey: 'scheduled_task_id' })
}
if (!ScheduledTaskRun.associations.task) {
  ScheduledTaskRun.belongsTo(ScheduledTask, { as: 'task', foreignKey: 'scheduled_task_id' })
}

export default ScheduledTaskRun
