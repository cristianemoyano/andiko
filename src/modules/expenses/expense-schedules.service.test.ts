import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  default: { transaction: (cb: (t: unknown) => unknown) => cb({}) },
}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const {
  expenseCreate,
  scheduleFindAll,
  scheduleFindOne,
  scheduleItemFindAll,
  createExpenseItemsMock,
  scheduleItemsToInputMock,
  calculateExpenseItemsMock,
} = vi.hoisted(() => ({
  expenseCreate: vi.fn(),
  scheduleFindAll: vi.fn(),
  scheduleFindOne: vi.fn(),
  scheduleItemFindAll: vi.fn(),
  createExpenseItemsMock: vi.fn(),
  scheduleItemsToInputMock: vi.fn<() => Array<Record<string, unknown>>>(() => []),
  calculateExpenseItemsMock: vi.fn(() => ({
    lines: [],
    totals: {
      subtotal: '100.00',
      discount_amount: '0.00',
      tax_amount: '21.00',
      total: '121.00',
    },
  })),
}))

vi.mock('./expense.model', () => ({ default: { create: expenseCreate } }))
vi.mock('./expense-schedule-item.model', () => ({
  default: { findAll: scheduleItemFindAll, destroy: vi.fn() },
}))
vi.mock('./expense-items.service', () => ({
  calculateExpenseItems: calculateExpenseItemsMock,
  createExpenseItems: createExpenseItemsMock,
  createExpenseScheduleItems: vi.fn(),
  scheduleItemsToInput: scheduleItemsToInputMock,
}))
vi.mock('./expense-schedule.model', () => ({
  default: {
    findAll: scheduleFindAll,
    findOne: scheduleFindOne,
  },
}))
vi.mock('./expenses-branch-associations', () => ({ ensureExpensesBranchAssociations: vi.fn() }))
vi.mock('./expenses.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./expenses.utils')>()
  return { ...actual, nextExpenseDocNumber: vi.fn(async () => 'EXP-01-0001') }
})

import {
  generateExpenseFromSchedule,
  findDueExpenseSchedules,
  updateExpenseSchedule,
} from './expense-schedules.service'

const t = {} as never

function mockSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    branch_id: 'branch-1',
    contact_id: 'contact-1',
    description: 'Alquiler local',
    expense_account_code: '5.2.05',
    default_amount: '150000.00',
    iva_rate: '21',
    frequency: 'monthly' as const,
    next_run_date: new Date('2026-07-01T00:00:00Z'),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  expenseCreate.mockResolvedValue({ id: 'exp-1' })
  scheduleItemFindAll.mockResolvedValue([])
  scheduleItemsToInputMock.mockReturnValue([])
})

describe('generateExpenseFromSchedule', () => {
  it('creates a draft recurring occurrence with totals from the schedule', async () => {
    const schedule = mockSchedule()

    await generateExpenseFromSchedule(schedule as never, 'org-1', t)

    expect(expenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        contact_id: 'contact-1',
        schedule_id: 'sched-1',
        kind: 'recurring_occurrence',
        expense_account_code: '5.2.05',
        status: 'draft',
        subtotal: '150000.00',
        tax_amount: '31500.00',
        total: '181500.00',
        balance: '181500.00',
      }),
      { transaction: t },
    )
  })

  it('advances next_run_date by the schedule frequency', async () => {
    const schedule = mockSchedule({ next_run_date: new Date('2026-07-01T00:00:00Z'), frequency: 'monthly' })

    await generateExpenseFromSchedule(schedule as never, 'org-1', t)

    expect(schedule.update).toHaveBeenCalledWith(
      { next_run_date: new Date('2026-08-01T00:00:00Z') },
      { transaction: t },
    )
  })

  it('advances next_run_date by two months for bimonthly schedules', async () => {
    const schedule = mockSchedule({ next_run_date: new Date('2026-07-01T00:00:00Z'), frequency: 'bimonthly' })

    await generateExpenseFromSchedule(schedule as never, 'org-1', t)

    expect(schedule.update).toHaveBeenCalledWith(
      { next_run_date: new Date('2026-09-01T00:00:00Z') },
      { transaction: t },
    )
  })

  it('copies schedule lines into the new occurrence snapshot', async () => {
    const schedule = mockSchedule({ created_by: 'user-1', updated_by: 'user-1' })
    const persistedItems = [{ id: 'schedule-item-1' }]
    const inputs = [{
      description: 'Cargo fijo',
      quantity: 1,
      unit_price: 100,
      discount_pct: 0,
      iva_rate: '21',
      expense_account_code: '5.2.05',
      sort_order: 0,
    }]
    scheduleItemFindAll.mockResolvedValue(persistedItems)
    scheduleItemsToInputMock.mockReturnValue(inputs)

    await generateExpenseFromSchedule(schedule as never, 'org-1', t)

    expect(createExpenseItemsMock).toHaveBeenCalledWith(
      'exp-1',
      inputs,
      'org-1',
      'user-1',
      t,
    )
  })
})

describe('findDueExpenseSchedules', () => {
  it('scopes the query to org, active recurring schedules, and due date', async () => {
    scheduleFindAll.mockResolvedValue([])
    const now = new Date('2026-07-13T00:00:00Z')

    await findDueExpenseSchedules('org-1', null, now)

    const call = scheduleFindAll.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where.org_id).toBe('org-1')
    expect(call.where.is_active).toBe(true)
    expect(call.where.kind).toBe('recurring')
    expect(call.where.branch_id).toBeUndefined()
  })

  it('scopes to a single branch when provided', async () => {
    scheduleFindAll.mockResolvedValue([])

    await findDueExpenseSchedules('org-1', 'branch-1', new Date())

    const call = scheduleFindAll.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where.branch_id).toBe('branch-1')
  })
})

describe('updateExpenseSchedule', () => {
  it('updates the amount used by future occurrences without rewriting existing expenses', async () => {
    const schedule = mockSchedule()
    scheduleFindOne.mockResolvedValue(schedule)

    await updateExpenseSchedule('sched-1', { default_amount: 175000 }, 'org-1', 'user-1')

    expect(scheduleFindOne).toHaveBeenCalledWith({
      where: { id: 'sched-1', org_id: 'org-1' },
      transaction: {},
      lock: true,
    })
    expect(schedule.update).toHaveBeenCalledWith(
      {
        default_amount: '175000',
        updated_by: 'user-1',
      },
      { transaction: {} },
    )
    expect(expenseCreate).not.toHaveBeenCalled()
  })
})
