import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { z } from 'zod'
import { Op } from 'sequelize'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('./actions', () => ({}))
vi.mock('./scheduled-task.model', () => ({
  default: { findAndCountAll: vi.fn(), findOne: vi.fn(), create: vi.fn(), count: vi.fn() },
}))
vi.mock('./scheduled-task-run.model', () => ({
  default: { findAndCountAll: vi.fn() },
}))

import ScheduledTask from './scheduled-task.model'
import ScheduledTaskRun from './scheduled-task-run.model'
import { registerAutomationAction } from './action-registry'
import {
  ScheduledTaskValidationError,
  createScheduledTask,
  getScheduledTask,
  listScheduledTasks,
  listScheduledTaskRuns,
  updateScheduledTask,
} from './scheduled-task.service'

const findAndCountAllMock = ScheduledTask.findAndCountAll as unknown as Mock
const findOneMock = ScheduledTask.findOne as unknown as Mock
const createMock = ScheduledTask.create as unknown as Mock
const countMock = ScheduledTask.count as unknown as Mock
const runFindAndCountAllMock = ScheduledTaskRun.findAndCountAll as unknown as Mock

registerAutomationAction({
  type: 'test.noop',
  label: 'No-op',
  payloadSchema: z.object({}),
  run: vi.fn(async () => ({})),
})

const ctxOrg1: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('listScheduledTasks', () => {
  it('scopes the query to the tenant org', async () => {
    findAndCountAllMock.mockResolvedValueOnce({ rows: [], count: 0 })
    await listScheduledTasks({ page: 1, limit: 20 }, ctxOrg1)
    expect(findAndCountAllMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ org_id: 'org-1' }),
    }))
  })

  it('scopes to org-wide tasks plus allowed branches when the caller is branch-restricted', async () => {
    findAndCountAllMock.mockResolvedValueOnce({ rows: [], count: 0 })
    const restrictedCtx: TenantContext = { ...ctxOrg1, allowedBranchIds: ['branch-a'] }

    await listScheduledTasks({ page: 1, limit: 20 }, restrictedCtx)

    expect(findAndCountAllMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        org_id: 'org-1',
        [Op.or]: [{ branch_id: null }, { branch_id: { [Op.in]: ['branch-a'] } }],
      }),
    }))
  })
})

describe('getScheduledTask', () => {
  it('scopes findOne to id + org_id when unrestricted', async () => {
    findOneMock.mockResolvedValueOnce(null)
    await getScheduledTask('task-1', ctxOrg1)
    expect(findOneMock).toHaveBeenCalledWith({ where: { id: 'task-1', org_id: 'org-1' } })
  })

  it('excludes tasks scoped to a branch outside the caller\'s allowed branches', async () => {
    findOneMock.mockResolvedValueOnce(null)
    const restrictedCtx: TenantContext = { ...ctxOrg1, allowedBranchIds: ['branch-a'] }

    await getScheduledTask('task-1', restrictedCtx)

    expect(findOneMock).toHaveBeenCalledWith({
      where: {
        id: 'task-1',
        org_id: 'org-1',
        [Op.or]: [{ branch_id: null }, { branch_id: { [Op.in]: ['branch-a'] } }],
      },
    })
  })
})

describe('createScheduledTask', () => {
  const validInput = {
    name: 'Vencer cotizaciones',
    action_type: 'test.noop',
    payload: {},
    cron_expression: '0 6 * * *',
    timezone: 'UTC',
    max_consecutive_failures: 5,
  }

  it('rejects an unknown action_type', async () => {
    countMock.mockResolvedValueOnce(0)
    await expect(
      createScheduledTask({ ...validInput, action_type: 'nope.unknown' }, ctxOrg1, 'user-1'),
    ).rejects.toThrow(ScheduledTaskValidationError)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('rejects a schedule denser than 1 minute', async () => {
    countMock.mockResolvedValueOnce(0)
    await expect(
      createScheduledTask({ ...validInput, cron_expression: '* * * * * *' }, ctxOrg1, 'user-1'),
    ).rejects.toThrow(ScheduledTaskValidationError)
  })

  it('rejects when the org already has the maximum number of active tasks', async () => {
    countMock.mockResolvedValueOnce(50)
    await expect(createScheduledTask(validInput, ctxOrg1, 'user-1')).rejects.toThrow(ScheduledTaskValidationError)
  })

  it('computes next_run_at and creates the task scoped to the org', async () => {
    countMock.mockResolvedValueOnce(0)
    createMock.mockResolvedValueOnce({ id: 'task-1' })

    await createScheduledTask(validInput, ctxOrg1, 'user-1')

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      org_id: 'org-1',
      action_type: 'test.noop',
      next_run_at: expect.any(Date),
      created_by: 'user-1',
    }))
  })

  it('rejects a branch not allowed for the tenant', async () => {
    countMock.mockResolvedValueOnce(0)
    const ctxLimited: TenantContext = { ...ctxOrg1, allowedBranchIds: ['branch-a'] }
    await expect(
      createScheduledTask({ ...validInput, branch_id: 'branch-b' }, ctxLimited, 'user-1'),
    ).rejects.toThrow()
    expect(createMock).not.toHaveBeenCalled()
  })
})

describe('updateScheduledTask', () => {
  it('returns null when the task does not belong to the org', async () => {
    findOneMock.mockResolvedValueOnce(null)
    const result = await updateScheduledTask('task-1', { name: 'x' }, ctxOrg1, 'user-1')
    expect(result).toBeNull()
  })

  it('recomputes next_run_at when the cron expression changes', async () => {
    const update = vi.fn(async function (this: Record<string, unknown>, fields: Record<string, unknown>) {
      Object.assign(this, fields)
    })
    findOneMock.mockResolvedValueOnce({
      action_type: 'test.noop',
      payload: {},
      cron_expression: '0 6 * * *',
      timezone: 'UTC',
      update,
    })

    await updateScheduledTask('task-1', { cron_expression: '0 7 * * *' }, ctxOrg1, 'user-1')

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ next_run_at: expect.any(Date) }))
  })

  it('does not reset consecutive_failures when status is re-sent unchanged', async () => {
    const update = vi.fn(async function (this: Record<string, unknown>, fields: Record<string, unknown>) {
      Object.assign(this, fields)
    })
    findOneMock.mockResolvedValueOnce({
      action_type: 'test.noop',
      payload: {},
      cron_expression: '0 6 * * *',
      timezone: 'UTC',
      status: 'active',
      consecutive_failures: 4,
      update,
    })

    await updateScheduledTask('task-1', { name: 'Nuevo nombre', status: 'active' }, ctxOrg1, 'user-1')

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))
    const [fields] = update.mock.calls[0] as [Record<string, unknown>]
    expect(fields).not.toHaveProperty('consecutive_failures')
  })

  it('resets consecutive_failures when status actually changes', async () => {
    const update = vi.fn(async function (this: Record<string, unknown>, fields: Record<string, unknown>) {
      Object.assign(this, fields)
    })
    findOneMock.mockResolvedValueOnce({
      action_type: 'test.noop',
      payload: {},
      cron_expression: '0 6 * * *',
      timezone: 'UTC',
      status: 'paused',
      consecutive_failures: 5,
      update,
    })

    await updateScheduledTask('task-1', { status: 'active' }, ctxOrg1, 'user-1')

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', consecutive_failures: 0 }))
  })
})

describe('listScheduledTaskRuns', () => {
  it('returns null when the task does not belong to the org', async () => {
    findOneMock.mockResolvedValueOnce(null)
    const result = await listScheduledTaskRuns('task-1', ctxOrg1, { page: 1, limit: 20 })
    expect(result).toBeNull()
    expect(runFindAndCountAllMock).not.toHaveBeenCalled()
  })

  it('scopes runs to the task and org', async () => {
    findOneMock.mockResolvedValueOnce({ id: 'task-1' })
    runFindAndCountAllMock.mockResolvedValueOnce({ rows: [], count: 0 })

    await listScheduledTaskRuns('task-1', ctxOrg1, { page: 1, limit: 20 })

    expect(runFindAndCountAllMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { scheduled_task_id: 'task-1', org_id: 'org-1' },
    }))
  })
})
