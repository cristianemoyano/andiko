import 'server-only'
import { Op } from 'sequelize'
import type { TenantContext } from '@/lib/tenancy'
import { TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { paginate, toPaginated, type PaginatedResult } from '@/lib/pagination'
import ScheduledTask from './scheduled-task.model'
import ScheduledTaskRun from './scheduled-task-run.model'
import { computeNextRunAt, minIntervalSecondsOf, validateCronExpression } from './cron'
import { getAutomationAction } from './action-registry'
import './actions'
import type { ScheduledTaskInput, ScheduledTaskQuery, ScheduledTaskUpdateInput } from './scheduled-task.schema'

/** Hard cap on active automations per org, so one tenant can't overwhelm shared tick capacity. */
const MAX_ACTIVE_TASKS_PER_ORG = 50

export class ScheduledTaskValidationError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'ScheduledTaskValidationError'
    this.code = code
  }
}

function assertBranchAllowed(branchId: string | null | undefined, ctx: TenantContext) {
  if (!branchId) return
  if (ctx.allowedBranchIds.length > 0 && !ctx.allowedBranchIds.includes(branchId)) {
    throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
  }
}

/**
 * Org scope + branch scope for reads. `branch_id` is nullable (org-wide automations),
 * so this can't reuse `whereAllowedBranches()` from `@/lib/tenancy` — that helper assumes
 * `branch_id NOT NULL` and would hide org-wide tasks from branch-restricted users. A
 * branch-restricted user sees org-wide tasks plus tasks scoped to their allowed branches.
 */
function scopedWhere(ctx: TenantContext, extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (ctx.allowedBranchIds.length === 0) {
    return { ...extra, org_id: ctx.orgId }
  }
  return {
    ...extra,
    org_id: ctx.orgId,
    [Op.or]: [{ branch_id: null }, { branch_id: { [Op.in]: ctx.allowedBranchIds } }],
  }
}

function validateActionAndSchedule(input: {
  action_type: string
  payload: Record<string, unknown>
  cron_expression: string
  timezone: string
}) {
  const action = getAutomationAction(input.action_type)
  if (!action) {
    throw new ScheduledTaskValidationError('UNKNOWN_ACTION_TYPE', `Tipo de acción desconocido: ${input.action_type}`)
  }

  const payloadResult = action.payloadSchema.safeParse(input.payload)
  if (!payloadResult.success) {
    throw new ScheduledTaskValidationError('INVALID_PAYLOAD', `Configuración inválida: ${payloadResult.error.message}`)
  }

  const cronResult = validateCronExpression(input.cron_expression)
  if (!cronResult.valid) {
    throw new ScheduledTaskValidationError('INVALID_CRON', `Expresión cron inválida: ${cronResult.error}`)
  }

  const minInterval = minIntervalSecondsOf(input.cron_expression, input.timezone)
  if (minInterval < 60) {
    throw new ScheduledTaskValidationError(
      'SCHEDULE_TOO_FREQUENT',
      'La frecuencia mínima admitida es de 1 minuto.',
    )
  }
}

export async function listScheduledTasks(
  query: ScheduledTaskQuery,
  ctx: TenantContext,
): Promise<PaginatedResult<ScheduledTask>> {
  const { page, limit } = query
  const { offset } = paginate(page, limit)
  const where = scopedWhere(ctx, query.status ? { status: query.status } : {})

  const { rows, count } = await ScheduledTask.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  })

  return toPaginated(rows, count, page, limit)
}

export async function getScheduledTask(id: string, ctx: TenantContext): Promise<ScheduledTask | null> {
  return ScheduledTask.findOne({ where: scopedWhere(ctx, { id }) })
}

export async function createScheduledTask(
  input: ScheduledTaskInput,
  ctx: TenantContext,
  actorId: string | null,
): Promise<ScheduledTask> {
  assertBranchAllowed(input.branch_id, ctx)
  validateActionAndSchedule(input)

  const activeCount = await ScheduledTask.count({ where: { org_id: ctx.orgId, status: 'active' } })
  if (activeCount >= MAX_ACTIVE_TASKS_PER_ORG) {
    throw new ScheduledTaskValidationError(
      'MAX_ACTIVE_TASKS_REACHED',
      `Se alcanzó el máximo de ${MAX_ACTIVE_TASKS_PER_ORG} automatizaciones activas.`,
    )
  }

  const nextRunAt = computeNextRunAt(input.cron_expression, input.timezone)

  return ScheduledTask.create({
    org_id: ctx.orgId,
    branch_id: input.branch_id ?? null,
    name: input.name,
    description: input.description ?? null,
    action_type: input.action_type,
    payload: input.payload,
    cron_expression: input.cron_expression,
    timezone: input.timezone,
    max_consecutive_failures: input.max_consecutive_failures,
    next_run_at: nextRunAt,
    created_by: actorId,
    updated_by: actorId,
  })
}

export async function updateScheduledTask(
  id: string,
  input: ScheduledTaskUpdateInput,
  ctx: TenantContext,
  actorId: string | null,
): Promise<ScheduledTask | null> {
  const task = await getScheduledTask(id, ctx)
  if (!task) return null

  if (input.branch_id !== undefined) assertBranchAllowed(input.branch_id, ctx)

  const nextActionType = input.action_type ?? task.action_type
  const nextPayload = input.payload ?? task.payload
  const nextCron = input.cron_expression ?? task.cron_expression
  const nextTimezone = input.timezone ?? task.timezone
  const scheduleChanged = input.cron_expression !== undefined || input.timezone !== undefined
  const actionOrPayloadChanged = input.action_type !== undefined || input.payload !== undefined

  if (scheduleChanged || actionOrPayloadChanged) {
    validateActionAndSchedule({
      action_type: nextActionType,
      payload: nextPayload,
      cron_expression: nextCron,
      timezone: nextTimezone,
    })
  }

  // Only clear the auto-pause failure streak when status is actually transitioning,
  // not merely re-sent unchanged (the UI always includes `status` on every edit).
  const statusChanged = input.status !== undefined && input.status !== task.status

  await task.update({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.branch_id !== undefined ? { branch_id: input.branch_id } : {}),
    ...(input.action_type !== undefined ? { action_type: input.action_type } : {}),
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
    ...(input.cron_expression !== undefined ? { cron_expression: input.cron_expression } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.max_consecutive_failures !== undefined ? { max_consecutive_failures: input.max_consecutive_failures } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(statusChanged ? { consecutive_failures: 0 } : {}),
    ...(scheduleChanged ? { next_run_at: computeNextRunAt(nextCron, nextTimezone) } : {}),
    updated_by: actorId,
  })

  return task
}

export async function deleteScheduledTask(id: string, ctx: TenantContext, actorId: string | null): Promise<boolean> {
  const task = await getScheduledTask(id, ctx)
  if (!task) return false
  await task.update({ updated_by: actorId, deleted_by: actorId })
  await task.destroy()
  return true
}

export async function listScheduledTaskRuns(
  taskId: string,
  ctx: TenantContext,
  query: { page: number; limit: number },
): Promise<PaginatedResult<ScheduledTaskRun> | null> {
  const task = await getScheduledTask(taskId, ctx)
  if (!task) return null

  const { page, limit } = query
  const { offset } = paginate(page, limit)
  const { rows, count } = await ScheduledTaskRun.findAndCountAll({
    where: { scheduled_task_id: taskId, org_id: ctx.orgId },
    order: [['started_at', 'DESC']],
    limit,
    offset,
  })

  return toPaginated(rows, count, page, limit)
}
