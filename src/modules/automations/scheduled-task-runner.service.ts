import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import ScheduledTask from './scheduled-task.model'
import ScheduledTaskRun, { type ScheduledTaskRunTriggerKind, type ScheduledTaskRunLogStatus } from './scheduled-task-run.model'
import { computeNextRunAt } from './cron'
import { getAutomationAction } from './action-registry'
// Side-effect import: registers every built-in automation action before any tick runs.
import './actions'

/** Wall-clock cap on a single automation action run. */
const ACTION_TIMEOUT_MS = 60_000

/** A claim older than this is considered abandoned (crashed process) and can be reclaimed. */
const STUCK_CLAIM_MS = 15 * 60 * 1000

/** How many claimed tasks a single tick runs at once, so one slow/heavy org doesn't stall the rest. */
const TICK_CONCURRENCY = 5

const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`

export interface TickResult {
  claimed: number
  succeeded: number
  failed: number
  skipped: number
}

export interface RunNowResult {
  status: ScheduledTaskRunLogStatus
  runId: string | null
  error?: string
}

/**
 * Races `promise` against a timeout and aborts `controller` when the timeout wins, so
 * actions that honor `AbortSignal` (via the context's `signal`) actually stop instead
 * of continuing to run in the background after being recorded as failed. The race
 * itself remains the safety net for actions that don't check the signal.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, controller: AbortController): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        controller.abort()
        reject(new Error(`Timed out after ${ms}ms`))
      }, ms)
    }),
  ])
}

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await fn(current)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

/**
 * Runs one already-claimed task's action, recording a scheduled_task_runs row and
 * updating the task's last_run_at/last_run_status/consecutive_failures. Auto-pauses
 * the task if it hits max_consecutive_failures in a row.
 */
async function executeClaimedTask(
  task: ScheduledTask,
  triggerKind: ScheduledTaskRunTriggerKind,
): Promise<{ status: ScheduledTaskRunLogStatus; runId: string }> {
  const startedAt = new Date()
  const run = await ScheduledTaskRun.create({
    scheduled_task_id: task.id,
    org_id: task.org_id!,
    status: 'running',
    trigger_kind: triggerKind,
    started_at: startedAt,
  })

  const finalize = async (
    status: Exclude<ScheduledTaskRunLogStatus, 'running'>,
    result: Record<string, unknown> | null,
    error: string | null,
  ) => {
    const finishedAt = new Date()
    await run.update({
      status,
      finished_at: finishedAt,
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      result,
      error,
    })

    const consecutiveFailures = status === 'failed' ? task.consecutive_failures + 1 : 0
    const shouldAutoPause = status === 'failed' && consecutiveFailures >= task.max_consecutive_failures

    await task.update({
      last_run_at: finishedAt,
      last_run_status: status,
      consecutive_failures: consecutiveFailures,
      claimed_at: null,
      claimed_by: null,
      ...(shouldAutoPause ? { status: 'paused' } : {}),
    })

    if (shouldAutoPause) {
      logger.warn({ taskId: task.id, consecutiveFailures }, 'automation task auto-paused after repeated failures')
    }
  }

  const action = getAutomationAction(task.action_type)
  if (!action) {
    await finalize('failed', null, `Tipo de acción desconocido: ${task.action_type}`)
    return { status: 'failed', runId: run.id }
  }

  const parsedPayload = action.payloadSchema.safeParse(task.payload)
  if (!parsedPayload.success) {
    await finalize('failed', null, `Payload inválido: ${parsedPayload.error.message}`)
    return { status: 'failed', runId: run.id }
  }

  const controller = new AbortController()
  try {
    const result = await withTimeout(
      action.run(
        { orgId: task.org_id!, branchId: task.branch_id, taskId: task.id, runId: run.id, signal: controller.signal },
        parsedPayload.data,
      ),
      ACTION_TIMEOUT_MS,
      controller,
    )
    await finalize('success', result.data ?? null, null)
    return { status: 'success', runId: run.id }
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 2000)
    await finalize('failed', null, message)
    logger.warn({ taskId: task.id, actionType: task.action_type, err: message }, 'automation task failed')
    return { status: 'failed', runId: run.id }
  }
}

/**
 * Claims and runs all active tasks whose next_run_at is due (or whose previous claim
 * looks abandoned). Safe under concurrent invocation — overlapping ticks or multiple
 * app replicas — via an optimistic-concurrency claim on `next_run_at` (only the first
 * UPDATE to change a row's `next_run_at` wins; the loser sees 0 rows affected and
 * skips it), the same pattern already used by the WooCommerce sync outbox.
 * `next_run_at` is advanced to the task's *next* fire time before the action runs, so
 * a slow action or a crashed process can't cause the row to be reprocessed in a tight
 * loop on the very next tick.
 *
 * Claiming stays sequential (cheap, one row at a time), but running claimed tasks'
 * actions happens with up to TICK_CONCURRENCY in flight — a handful of slow actions
 * (a webhook near its timeout, a future sync-style action) shouldn't serialize behind
 * each other and stall the rest of the batch. Each task's execution is isolated in its
 * own try/catch so a failure that somehow escapes executeClaimedTask's own error
 * handling (e.g. a DB error inside finalize() itself) can't abort the other tasks.
 */
export async function runDueScheduledTasks(limit = 50): Promise<TickResult> {
  const now = new Date()
  const staleClaimBefore = new Date(now.getTime() - STUCK_CLAIM_MS)

  const candidates = await ScheduledTask.findAll({
    where: {
      status: 'active',
      next_run_at: { [Op.lte]: now },
      deleted_at: null,
      [Op.or]: [{ claimed_at: null }, { claimed_at: { [Op.lte]: staleClaimBefore } }],
    },
    order: [['next_run_at', 'ASC']],
    limit,
  })

  const result: TickResult = { claimed: 0, succeeded: 0, failed: 0, skipped: 0 }
  const claimedTasks: ScheduledTask[] = []

  for (const task of candidates) {
    const previousNextRunAt = task.next_run_at
    let nextRunAt: Date
    try {
      nextRunAt = computeNextRunAt(task.cron_expression, task.timezone, now)
    } catch (err) {
      logger.warn({ taskId: task.id, err: String(err) }, 'automation task has an invalid cron expression, skipping')
      result.skipped += 1
      continue
    }

    const [claimed] = await ScheduledTask.update(
      { claimed_at: now, claimed_by: INSTANCE_ID, next_run_at: nextRunAt },
      { where: { id: task.id, next_run_at: previousNextRunAt } },
    )
    if (claimed === 0) {
      // Another concurrent tick already claimed this row.
      continue
    }
    // The claim above is a static (bulk) UPDATE, so it doesn't touch this in-memory
    // instance. Sync it now — otherwise Sequelize's dirty-checking sees claimed_at as
    // still `null` and silently drops it from finalize()'s later UPDATE, leaving the
    // row stuck looking "claimed" forever.
    task.set({ claimed_at: now, claimed_by: INSTANCE_ID, next_run_at: nextRunAt })

    result.claimed += 1
    claimedTasks.push(task)
  }

  await runWithConcurrency(claimedTasks, TICK_CONCURRENCY, async (task) => {
    try {
      const { status } = await executeClaimedTask(task, 'scheduled')
      if (status === 'success') result.succeeded += 1
      else if (status === 'failed') result.failed += 1
      else result.skipped += 1
    } catch (err) {
      logger.error(
        { taskId: task.id, err: String(err) },
        'automation task run crashed outside its own error handling',
      )
      result.failed += 1
    }
  })

  return result
}

/** Runs one task immediately ("Ejecutar ahora"), without disturbing its scheduled next_run_at. */
export async function runScheduledTaskNow(taskId: string, ctx: TenantContext): Promise<RunNowResult> {
  const where: Record<string, unknown> = ctx.allowedBranchIds.length > 0
    ? {
        id: taskId,
        org_id: ctx.orgId,
        deleted_at: null,
        [Op.or]: [{ branch_id: null }, { branch_id: { [Op.in]: ctx.allowedBranchIds } }],
      }
    : { id: taskId, org_id: ctx.orgId, deleted_at: null }
  const task = await ScheduledTask.findOne({ where })
  if (!task) {
    throw new Error('TASK_NOT_FOUND')
  }
  if (task.status === 'disabled') {
    return { status: 'skipped', runId: null, error: 'La automatización está deshabilitada.' }
  }

  const now = new Date()
  const staleClaimBefore = new Date(now.getTime() - STUCK_CLAIM_MS)
  const [claimed] = await ScheduledTask.update(
    { claimed_at: now, claimed_by: INSTANCE_ID },
    {
      where: {
        id: task.id,
        [Op.or]: [{ claimed_at: null }, { claimed_at: { [Op.lte]: staleClaimBefore } }],
      },
    },
  )
  if (claimed === 0) {
    return { status: 'skipped', runId: null, error: 'Ya hay una ejecución en curso para esta automatización.' }
  }
  // See comment in runDueScheduledTasks: sync the in-memory instance after the bulk claim.
  task.set({ claimed_at: now, claimed_by: INSTANCE_ID })

  const { status, runId } = await executeClaimedTask(task, 'manual')
  return { status, runId }
}
