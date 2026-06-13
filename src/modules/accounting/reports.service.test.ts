import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ default: { query: queryMock } }))

import { getTrialBalance } from './reports.service'

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
})
