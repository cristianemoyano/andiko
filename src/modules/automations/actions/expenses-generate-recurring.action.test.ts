import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn((cb: (t: unknown) => unknown) => cb({})) } }))
vi.mock('@/modules/expenses/expense-schedules.service', () => ({
  findDueExpenseSchedules: vi.fn(),
  generateExpenseFromSchedule: vi.fn(),
}))

import {
  findDueExpenseSchedules,
  generateExpenseFromSchedule,
} from '@/modules/expenses/expense-schedules.service'
import { getAutomationAction } from '../action-registry'
import './expenses-generate-recurring.action'

const findDueMock = findDueExpenseSchedules as unknown as Mock
const generateMock = generateExpenseFromSchedule as unknown as Mock

beforeEach(() => {
  findDueMock.mockReset()
  generateMock.mockReset()
})

const baseCtx = { orgId: 'org-1', branchId: null, taskId: 'task-1', runId: 'run-1', signal: new AbortController().signal }

describe('expenses.generate_recurring_expense action', () => {
  it('is registered', () => {
    expect(getAutomationAction('expenses.generate_recurring_expense')).toBeDefined()
  })

  it('generates an expense for every due schedule and reports a summary', async () => {
    findDueMock.mockResolvedValue([{ id: 'sched-1' }, { id: 'sched-2' }])
    generateMock.mockResolvedValue({ id: 'exp-1' })
    const action = getAutomationAction('expenses.generate_recurring_expense')!

    const result = await action.run(baseCtx, {})

    expect(findDueMock).toHaveBeenCalledWith('org-1', null, expect.any(Date))
    expect(generateMock).toHaveBeenCalledTimes(2)
    expect(result.data).toEqual({ generated: 2, failed: 0, examined: 2 })
    expect(result.summary).toContain('2 gasto')
  })

  it('isolates failures per schedule and still reports partial success', async () => {
    findDueMock.mockResolvedValue([{ id: 'sched-1' }, { id: 'sched-2' }])
    generateMock
      .mockResolvedValueOnce({ id: 'exp-1' })
      .mockRejectedValueOnce(new Error('boom'))
    const action = getAutomationAction('expenses.generate_recurring_expense')!

    const result = await action.run(baseCtx, {})

    expect(result.data).toEqual({ generated: 1, failed: 1, examined: 2 })
    expect(result.summary).toContain('1 fallido')
  })

  it('reports zero generated when nothing is due', async () => {
    findDueMock.mockResolvedValue([])
    const action = getAutomationAction('expenses.generate_recurring_expense')!

    const result = await action.run(baseCtx, {})

    expect(generateMock).not.toHaveBeenCalled()
    expect(result.data).toEqual({ generated: 0, failed: 0, examined: 0 })
  })
})
