import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ default: { query: queryMock } }))

import { getTrialBalance, getIncomeStatement } from './reports.service'
import { CLOSING_SOURCE_TYPES } from './accounting-period.constants'

const ctx: TenantContext = { orgId: 'org-1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }

describe('accounting/reports.service getTrialBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes saldo deudor/acreedor per account and column totals', async () => {
    queryMock.mockResolvedValue([
      { account_id: 'a1', code: '1.1.01.01', name: 'Caja', type: 'asset', total_debit: '1000.00', total_credit: '400.00' },
      { account_id: 'a2', code: '4.1.01', name: 'Ventas', type: 'income', total_debit: '0.00', total_credit: '600.00' },
    ])

    const result = await getTrialBalance({}, ctx)

    expect(result.rows[0]).toMatchObject({ code: '1.1.01.01', saldo_debit: '600.00', saldo_credit: '0.00' })
    expect(result.rows[1]).toMatchObject({ code: '4.1.01', saldo_debit: '0.00', saldo_credit: '600.00' })
    expect(result.totals).toEqual({
      total_debit: '1000.00',
      total_credit: '1000.00',
      saldo_debit: '600.00',
      saldo_credit: '600.00',
    })
  })

  it('passes date and branch filters as replacements', async () => {
    queryMock.mockResolvedValue([])
    await getTrialBalance({ from: '2026-01-01', to: '2026-12-31', branch_id: 'b1' }, ctx)

    const opts = queryMock.mock.calls[0]![1] as { replacements: Record<string, unknown> }
    expect(opts.replacements).toMatchObject({
      orgId: 'org-1',
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      branchId: 'b1',
    })
  })

  it('defaults missing filters to null', async () => {
    queryMock.mockResolvedValue([])
    await getTrialBalance({}, ctx)
    const opts = queryMock.mock.calls[0]![1] as { replacements: Record<string, unknown> }
    expect(opts.replacements).toMatchObject({ fromDate: null, toDate: null, branchId: null })
  })

  it('omits the source_type exclusion unless requested', async () => {
    queryMock.mockResolvedValue([])
    await getTrialBalance({}, ctx)
    const sql = queryMock.mock.calls[0]![0] as string
    const opts = queryMock.mock.calls[0]![1] as { replacements: Record<string, unknown> }
    expect(sql).not.toContain('source_type')
    expect(opts.replacements).not.toHaveProperty('excludedSourceTypes')
  })

  it('filters excluded source types when the option is passed', async () => {
    queryMock.mockResolvedValue([])
    await getTrialBalance({}, ctx, { excludeSourceTypes: ['period_close'] })
    const sql = queryMock.mock.calls[0]![0] as string
    const opts = queryMock.mock.calls[0]![1] as { replacements: Record<string, unknown> }
    expect(sql).toContain('e.source_type IS NULL OR e.source_type NOT IN (:excludedSourceTypes)')
    expect(opts.replacements.excludedSourceTypes).toEqual(['period_close'])
  })
})

describe('accounting/reports.service getIncomeStatement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('excludes closing entries and summarizes only result accounts', async () => {
    queryMock.mockResolvedValue([
      { account_id: 'a1', code: '1.1.01.01', name: 'Caja', type: 'asset', total_debit: '500.00', total_credit: '0.00' },
      { account_id: 'a2', code: '4.1.01', name: 'Ventas', type: 'income', total_debit: '0.00', total_credit: '600.00' },
      { account_id: 'a3', code: '5.1.01', name: 'CMV', type: 'expense', total_debit: '250.00', total_credit: '0.00' },
    ])

    const result = await getIncomeStatement({ from: '2026-01-01', to: '2026-01-31' }, ctx)

    const opts = queryMock.mock.calls[0]![1] as { replacements: Record<string, unknown> }
    expect(opts.replacements.excludedSourceTypes).toEqual([...CLOSING_SOURCE_TYPES])
    expect(result.total_ingresos).toBe('600.00')
    expect(result.total_costo).toBe('250.00')
    expect(result.resultado_neto).toBe('350.00')
    expect(result.from).toBe('2026-01-01')
  })
})
