import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { z } from 'zod'
import { Op } from 'sequelize'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./actions', () => ({}))
vi.mock('./scheduled-task.model', () => ({
  default: { findAll: vi.fn(), update: vi.fn(), findOne: vi.fn() },
}))
vi.mock('./scheduled-task-run.model', () => ({
  default: { create: vi.fn() },
}))

import ScheduledTask from './scheduled-task.model'
import ScheduledTaskRun from './scheduled-task-run.model'
import { registerAutomationAction } from './action-registry'
import { runDueScheduledTasks, runScheduledTaskNow } from './scheduled-task-runner.service'

const findAllMock = ScheduledTask.findAll as unknown as Mock
const updateMock = ScheduledTask.update as unknown as Mock
const findOneMock = ScheduledTask.findOne as unknown as Mock
const runCreateMock = ScheduledTaskRun.create as unknown as Mock

function makeTask(overrides: Record<string, unknown> = {}) {
  const base = {
    id: 'task-1',
    org_id: 'org-1',
    branch_id: null,
    action_type: 'test.succeed',
    payload: {},
    cron_expression: '* * * * *',
    timezone: 'UTC',
    status: 'active',
    next_run_at: new Date('2026-07-11T10:00:00Z'),
    consecutive_failures: 0,
    max_consecutive_failures: 2,
    set: vi.fn(function (this: Record<string, unknown>, fields: Record<string, unknown>) {
      Object.assign(this, fields)
    }),
    update: vi.fn(async function (this: Record<string, unknown>, fields: Record<string, unknown>) {
      Object.assign(this, fields)
      return this
    }),
    ...overrides,
  }
  return base as unknown as ScheduledTask
}

function makeRun() {
  const run: Record<string, unknown> = { id: `run-${Math.random().toString(36).slice(2, 8)}`, started_at: new Date() }
  run.update = vi.fn(async (fields: Record<string, unknown>) => {
    Object.assign(run, fields)
    return run
  })
  return run
}

// Registered once: action-registry has no unregister API by design (action types are
// meant to be static for the lifetime of the process), so tests share these two fakes.
registerAutomationAction({
  type: 'test.succeed',
  label: 'Succeed',
  payloadSchema: z.object({}),
  run: vi.fn(async () => ({ data: { ok: true } })),
})
registerAutomationAction({
  type: 'test.fail',
  label: 'Fail',
  payloadSchema: z.object({}),
  run: vi.fn(async () => {
    throw new Error('boom')
  }),
})

const trackableLog: string[] = []
registerAutomationAction({
  type: 'test.trackable',
  label: 'Trackable',
  payloadSchema: z.object({ id: z.string(), delayMs: z.number() }),
  async run(_ctx, payload) {
    trackableLog.push(`start-${payload.id}`)
    await new Promise(resolve => setTimeout(resolve, payload.delayMs))
    trackableLog.push(`end-${payload.id}`)
    return {}
  },
})

let lastHangingSignal: AbortSignal | undefined
registerAutomationAction({
  type: 'test.hangs',
  label: 'Hangs',
  payloadSchema: z.object({}),
  async run(ctx) {
    lastHangingSignal = ctx.signal
    return new Promise(() => {}) // never resolves on its own — only the timeout ends it
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  trackableLog.length = 0
  lastHangingSignal = undefined
})

describe('runDueScheduledTasks', () => {
  it('only claims tasks returned by the due-tasks query', async () => {
    findAllMock.mockResolvedValueOnce([])

    const result = await runDueScheduledTasks()

    expect(findAllMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'active' }),
    }))
    expect(result).toEqual({ claimed: 0, succeeded: 0, failed: 0, skipped: 0 })
  })

  it('claims a due task, runs its action, and records a successful run', async () => {
    const task = makeTask()
    const originalNextRunAt = task.next_run_at
    findAllMock.mockResolvedValueOnce([task])
    updateMock.mockResolvedValueOnce([1])
    runCreateMock.mockResolvedValueOnce(makeRun())

    const result = await runDueScheduledTasks()

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ claimed_by: expect.any(String) }),
      expect.objectContaining({ where: { id: 'task-1', next_run_at: originalNextRunAt } }),
    )
    expect(result).toEqual({ claimed: 1, succeeded: 1, failed: 0, skipped: 0 })
    expect(task.update).toHaveBeenCalledWith(expect.objectContaining({ last_run_status: 'success' }))
    // Regression guard: the claim is a bulk (static) UPDATE that bypasses Sequelize's
    // dirty-checking on this in-memory instance. Without syncing it via `set()`, a
    // later `task.update({ claimed_at: null })` in finalize would see no change from
    // its (still `null`) in-memory value and silently drop the field, leaving the row
    // stuck looking permanently claimed.
    expect(task.set).toHaveBeenCalledWith(expect.objectContaining({ claimed_at: expect.any(Date), claimed_by: expect.any(String) }))
    expect(task.update).toHaveBeenCalledWith(expect.objectContaining({ claimed_at: null, claimed_by: null }))
  })

  it('two concurrent ticks never both process the same row (CAS loser is skipped)', async () => {
    const task = makeTask()
    findAllMock.mockResolvedValue([task])
    runCreateMock.mockResolvedValue(makeRun())
    // First tick's claim succeeds (1 row affected), second tick's claim loses the race (0 rows).
    updateMock.mockResolvedValueOnce([1]).mockResolvedValueOnce([0])

    const [first, second] = await Promise.all([runDueScheduledTasks(), runDueScheduledTasks()])

    const combined = { claimed: first.claimed + second.claimed, succeeded: first.succeeded + second.succeeded }
    expect(combined).toEqual({ claimed: 1, succeeded: 1 })
  })

  it('advances next_run_at before running the action, even if the action fails', async () => {
    const task = makeTask({ action_type: 'test.fail' })
    const originalNextRunAt = task.next_run_at
    findAllMock.mockResolvedValueOnce([task])
    updateMock.mockResolvedValueOnce([1])
    runCreateMock.mockResolvedValueOnce(makeRun())

    await runDueScheduledTasks()

    const [claimFields] = updateMock.mock.calls[0] as [Record<string, unknown>]
    expect(claimFields.next_run_at).toBeInstanceOf(Date)
    expect((claimFields.next_run_at as Date).getTime()).toBeGreaterThan(originalNextRunAt.getTime())
  })

  it('increments consecutive_failures on failure and auto-pauses at the threshold', async () => {
    const task = makeTask({ action_type: 'test.fail', consecutive_failures: 1, max_consecutive_failures: 2 })
    findAllMock.mockResolvedValueOnce([task])
    updateMock.mockResolvedValueOnce([1])
    runCreateMock.mockResolvedValueOnce(makeRun())

    const result = await runDueScheduledTasks()

    expect(result.failed).toBe(1)
    expect(task.update).toHaveBeenCalledWith(expect.objectContaining({
      consecutive_failures: 2,
      status: 'paused',
    }))
  })

  it('aborts the action context signal when the action times out', async () => {
    vi.useFakeTimers()
    try {
      const task = makeTask({ action_type: 'test.hangs' })
      findAllMock.mockResolvedValueOnce([task])
      updateMock.mockResolvedValueOnce([1])
      runCreateMock.mockResolvedValueOnce(makeRun())

      const resultPromise = runDueScheduledTasks()
      await vi.advanceTimersByTimeAsync(60_000) // matches ACTION_TIMEOUT_MS
      const result = await resultPromise

      expect(result.failed).toBe(1)
      expect(lastHangingSignal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('runs claimed tasks concurrently instead of one at a time', async () => {
    const taskA = makeTask({ id: 'task-a', action_type: 'test.trackable', payload: { id: 'a', delayMs: 30 } })
    const taskB = makeTask({ id: 'task-b', action_type: 'test.trackable', payload: { id: 'b', delayMs: 10 } })
    findAllMock.mockResolvedValueOnce([taskA, taskB])
    updateMock.mockResolvedValueOnce([1]).mockResolvedValueOnce([1])
    runCreateMock.mockResolvedValueOnce(makeRun()).mockResolvedValueOnce(makeRun())

    const result = await runDueScheduledTasks()

    expect(result).toEqual({ claimed: 2, succeeded: 2, failed: 0, skipped: 0 })
    // If they ran sequentially, 'start-b' would only appear after 'end-a'. Running
    // concurrently, b (shorter delay) starts before a finishes.
    expect(trackableLog.indexOf('start-b')).toBeLessThan(trackableLog.indexOf('end-a'))
  })

  it('isolates a task whose execution throws outside its own error handling from the rest of the batch', async () => {
    const taskA = makeTask({ id: 'task-a' })
    const taskB = makeTask({ id: 'task-b' })
    findAllMock.mockResolvedValueOnce([taskA, taskB])
    updateMock.mockResolvedValueOnce([1]).mockResolvedValueOnce([1])
    // Task A's run-row creation itself fails (outside executeClaimedTask's action try/catch).
    runCreateMock.mockRejectedValueOnce(new Error('db unavailable')).mockResolvedValueOnce(makeRun())

    const result = await runDueScheduledTasks()

    expect(result).toEqual({ claimed: 2, succeeded: 1, failed: 1, skipped: 0 })
  })
})

describe('runScheduledTaskNow', () => {
  const ctx = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] as string[] }

  it('throws when the task does not exist for that org', async () => {
    findOneMock.mockResolvedValueOnce(null)
    await expect(runScheduledTaskNow('missing', ctx)).rejects.toThrow('TASK_NOT_FOUND')
  })

  it('skips when the task is disabled', async () => {
    findOneMock.mockResolvedValueOnce(makeTask({ status: 'disabled' }))
    const result = await runScheduledTaskNow('task-1', ctx)
    expect(result.status).toBe('skipped')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('tags the run as manual and does not touch next_run_at', async () => {
    const task = makeTask()
    findOneMock.mockResolvedValueOnce(task)
    updateMock.mockResolvedValueOnce([1])
    runCreateMock.mockResolvedValueOnce(makeRun())

    const result = await runScheduledTaskNow('task-1', ctx)

    expect(result.status).toBe('success')
    expect(runCreateMock).toHaveBeenCalledWith(expect.objectContaining({ trigger_kind: 'manual' }))
    const [claimFields] = updateMock.mock.calls[0] as [Record<string, unknown>]
    expect(claimFields.next_run_at).toBeUndefined()
  })

  it('skips when another execution already holds the claim', async () => {
    findOneMock.mockResolvedValueOnce(makeTask())
    updateMock.mockResolvedValueOnce([0])

    const result = await runScheduledTaskNow('task-1', ctx)

    expect(result.status).toBe('skipped')
    expect(runCreateMock).not.toHaveBeenCalled()
  })

  it('scopes the lookup to org-wide tasks plus the caller\'s allowed branches when restricted', async () => {
    findOneMock.mockResolvedValueOnce(null)
    const restrictedCtx = { ...ctx, allowedBranchIds: ['branch-a'] }

    await expect(runScheduledTaskNow('task-1', restrictedCtx)).rejects.toThrow('TASK_NOT_FOUND')

    expect(findOneMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'task-1',
        org_id: 'org-1',
        [Op.or]: [{ branch_id: null }, { branch_id: { [Op.in]: ['branch-a'] } }],
      }),
    })
  })
})
