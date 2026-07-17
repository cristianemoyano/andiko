import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const {
  transactionMock, queryMock,
  periodFindOne, periodCreate, periodFindAndCountAll,
  accountFindAll, entryFindOne, entryFindAll, lineFindAll,
  createPostedEntryMock,
} = vi.hoisted(() => {
  const fakeTransaction = { LOCK: { UPDATE: 'UPDATE' } }
  return {
    transactionMock: vi.fn(async (fn: unknown) => (fn as (t: unknown) => unknown)(fakeTransaction)),
    queryMock: vi.fn(),
    periodFindOne: vi.fn(),
    periodCreate: vi.fn(),
    periodFindAndCountAll: vi.fn(),
    accountFindAll: vi.fn(),
    entryFindOne: vi.fn(),
    entryFindAll: vi.fn(),
    lineFindAll: vi.fn(),
    createPostedEntryMock: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ default: { transaction: transactionMock, query: queryMock } }))
vi.mock('./accounting-period.model', () => ({
  default: { findOne: periodFindOne, create: periodCreate, findAndCountAll: periodFindAndCountAll },
}))
vi.mock('./account.model', () => ({ default: { findAll: accountFindAll } }))
vi.mock('./journal-entry.model', () => ({ default: { findOne: entryFindOne, findAll: entryFindAll } }))
vi.mock('./journal-entry-line.model', () => ({ default: { findAll: lineFindAll } }))
vi.mock('./accounting-auto-post.utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('./accounting-auto-post.utils')>()
  return { ...original, createPostedEntry: createPostedEntryMock }
})

import { closePeriod, reopenPeriod } from './period-close.service'

const ctx: TenantContext = { orgId: 'org-1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }

const BALANCES = [
  { account_id: 'ventas', code: '4.1.01', name: 'Ventas', type: 'income', saldo_debit: '0.00', saldo_credit: '1000.00' },
  { account_id: 'cmv', code: '5.1.01', name: 'CMV', type: 'expense', saldo_debit: '400.00', saldo_credit: '0.00' },
]

describe('accounting/period-close.service closePeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return []
      return BALANCES
    })
    periodFindOne.mockResolvedValue(null)
    accountFindAll.mockResolvedValue([
      { id: 'acc-3202', code: '3.2.02', is_active: true, is_postable: true },
    ])
    periodCreate.mockResolvedValue({ id: 'p1', update: vi.fn() })
    createPostedEntryMock.mockResolvedValue({ id: 'entry-1', entry_number: 'AS-000009' })
  })

  it('creates the period and a posted closing entry linked to it', async () => {
    const periodUpdate = vi.fn()
    periodCreate.mockResolvedValue({ id: 'p1', update: periodUpdate })

    await closePeriod({ from: '2026-06-01', to: '2026-06-30' }, ctx, 'actor-1')

    expect(periodCreate).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: 'org-1', start_date: '2026-06-01', end_date: '2026-06-30', status: 'closed' }),
      expect.anything(),
    )
    const entryParams = createPostedEntryMock.mock.calls[0]![0]
    expect(entryParams).toMatchObject({ sourceType: 'period_close', sourceId: 'p1', branchId: null })
    expect(entryParams.lines.find((l: { account_id: string }) => l.account_id === 'acc-3202')).toMatchObject({ credit: '600.00' })
    expect(periodUpdate).toHaveBeenCalledWith({ closing_entry_id: 'entry-1' }, expect.anything())
  })

  it('rejects a range that overlaps an existing closed period', async () => {
    periodFindOne.mockResolvedValue({ id: 'existing' })
    await expect(closePeriod({ from: '2026-06-01', to: '2026-06-30' }, ctx, 'actor-1')).rejects.toThrow('PERIOD_OVERLAP')
    expect(periodCreate).not.toHaveBeenCalled()
  })

  it('rejects when there are no result balances in range', async () => {
    queryMock.mockImplementation(async (sql: string) => (sql.includes('pg_advisory_xact_lock') ? [] : []))
    await expect(closePeriod({ from: '2026-06-01', to: '2026-06-30' }, ctx, 'actor-1')).rejects.toThrow('NOTHING_TO_CLOSE')
  })

  it('rejects when 3.2.02 is missing or not postable', async () => {
    accountFindAll.mockResolvedValue([{ id: 'acc-3202', code: '3.2.02', is_active: true, is_postable: false }])
    await expect(closePeriod({ from: '2026-06-01', to: '2026-06-30' }, ctx, 'actor-1')).rejects.toThrow('CLOSING_ACCOUNT_MISSING')
  })
})

describe('accounting/period-close.service reopenPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createPostedEntryMock.mockResolvedValue({ id: 'entry-2', entry_number: 'AS-000010' })
  })

  it('creates a reversal entry with swapped sides and marks the period reopened', async () => {
    const periodUpdate = vi.fn()
    periodFindOne.mockResolvedValue({
      id: 'p1', status: 'closed', closing_entry_id: 'entry-1',
      start_date: '2026-06-01', end_date: '2026-06-30', update: periodUpdate,
    })
    entryFindOne.mockResolvedValue({ id: 'entry-1', entry_date: '2026-06-30' })
    lineFindAll.mockResolvedValue([
      { account_id: 'ventas', debit: '1000.00', credit: '0.00', description: 'Cierre 4.1.01 Ventas' },
      { account_id: 'acc-3202', debit: '0.00', credit: '1000.00', description: 'Resultado del ejercicio (ganancia)' },
    ])

    await reopenPeriod('p1', ctx, 'actor-1')

    const entryParams = createPostedEntryMock.mock.calls[0]![0]
    expect(entryParams).toMatchObject({ sourceType: 'period_close_reversal', sourceId: 'p1' })
    expect(entryParams.lines[0]).toMatchObject({ account_id: 'ventas', debit: '0.00', credit: '1000.00' })
    expect(entryParams.lines[1]).toMatchObject({ account_id: 'acc-3202', debit: '1000.00', credit: '0.00' })
    expect(periodUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reopened', reversal_entry_id: 'entry-2' }),
      expect.anything(),
    )
  })

  it('rejects reopening a period that is not closed', async () => {
    periodFindOne.mockResolvedValue({ id: 'p1', status: 'reopened', closing_entry_id: 'entry-1' })
    await expect(reopenPeriod('p1', ctx, 'actor-1')).rejects.toThrow('PERIOD_NOT_CLOSED')
  })

  it('rejects an unknown period', async () => {
    periodFindOne.mockResolvedValue(null)
    await expect(reopenPeriod('ghost', ctx, 'actor-1')).rejects.toThrow('PERIOD_NOT_FOUND')
  })
})
