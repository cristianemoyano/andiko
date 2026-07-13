import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ default: {} }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { expenseCreate, templateFindAll } = vi.hoisted(() => ({
  expenseCreate: vi.fn(),
  templateFindAll: vi.fn(),
}))

vi.mock('./expense.model', () => ({ default: { create: expenseCreate } }))
vi.mock('./recurring-expense-template.model', () => ({ default: { findAll: templateFindAll } }))
vi.mock('./expenses-branch-associations', () => ({ ensureExpensesBranchAssociations: vi.fn() }))
vi.mock('./expenses.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./expenses.utils')>()
  return { ...actual, nextExpenseDocNumber: vi.fn(async () => 'EXP-01-0001') }
})

import {
  generateExpenseFromTemplate,
  findDueRecurringExpenseTemplates,
} from './recurring-expense-templates.service'

const t = {} as never

function mockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-1',
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

describe('generateExpenseFromTemplate', () => {
  it('creates a draft expense with totals derived from the template', async () => {
    const template = mockTemplate()

    await generateExpenseFromTemplate(template as never, 'org-1', t)

    expect(expenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        contact_id: 'contact-1',
        recurring_template_id: 'tpl-1',
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

  it('advances next_run_date by the template frequency', async () => {
    const template = mockTemplate({ next_run_date: new Date('2026-07-01T00:00:00Z'), frequency: 'monthly' })

    await generateExpenseFromTemplate(template as never, 'org-1', t)

    expect(template.update).toHaveBeenCalledWith(
      { next_run_date: new Date('2026-08-01T00:00:00Z') },
      { transaction: t },
    )
  })
})

describe('findDueRecurringExpenseTemplates', () => {
  it('scopes the query to org, active templates, and due date', async () => {
    templateFindAll.mockResolvedValue([])
    const now = new Date('2026-07-13T00:00:00Z')

    await findDueRecurringExpenseTemplates('org-1', null, now)

    const call = templateFindAll.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where.org_id).toBe('org-1')
    expect(call.where.is_active).toBe(true)
    expect(call.where.branch_id).toBeUndefined()
  })

  it('scopes to a single branch when provided', async () => {
    templateFindAll.mockResolvedValue([])

    await findDueRecurringExpenseTemplates('org-1', 'branch-1', new Date())

    const call = templateFindAll.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where.branch_id).toBe('branch-1')
  })
})
