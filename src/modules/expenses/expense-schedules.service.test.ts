import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: {} }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { expenseCreate, scheduleFindAll } = vi.hoisted(() => ({
  expenseCreate: vi.fn(),
  scheduleFindAll: vi.fn(),
}))

vi.mock('./expense.model', () => ({ default: { create: expenseCreate } }))
vi.mock('./expense-schedule.model', () => ({ default: { findAll: scheduleFindAll } }))
vi.mock('./expenses-branch-associations', () => ({ ensureExpensesBranchAssociations: vi.fn() }))
vi.mock('./expenses.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./expenses.utils')>()
  return { ...actual, nextExpenseDocNumber: vi.fn(async () => 'EXP-01-0001') }
})

import {
  generateExpenseFromSchedule,
  findDueExpenseSchedules,
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
