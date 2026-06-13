import { describe, it, expect, vi, beforeEach } from 'vitest'

const { accountCount, accountCreate } = vi.hoisted(() => ({ accountCount: vi.fn(), accountCreate: vi.fn() }))
vi.mock('./account.model', () => ({ default: { count: accountCount, create: accountCreate } }))

import { seedDefaultChartOfAccounts } from './chart-seed'
import { DEFAULT_CHART_OF_ACCOUNTS } from './default-chart'

const fakeT = {} as never

describe('accounting/chart-seed seedDefaultChartOfAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    accountCreate.mockImplementation(async (data: { code: string }) => ({ id: `id-${data.code}` }))
  })

  it('is idempotent: does nothing when the org already has accounts', async () => {
    accountCount.mockResolvedValue(5)
    const created = await seedDefaultChartOfAccounts('org-1', fakeT)
    expect(created).toBe(0)
    expect(accountCreate).not.toHaveBeenCalled()
  })

  it('seeds the full default chart and resolves parent ids by code', async () => {
    accountCount.mockResolvedValue(0)
    const created = await seedDefaultChartOfAccounts('org-1', fakeT, 'actor-1')

    expect(created).toBe(DEFAULT_CHART_OF_ACCOUNTS.length)
    expect(accountCreate).toHaveBeenCalledTimes(DEFAULT_CHART_OF_ACCOUNTS.length)

    const calls = accountCreate.mock.calls.map(c => c[0] as { code: string; parent_id: string | null })
    const top = calls.find(c => c.code === '1')!
    expect(top.parent_id).toBeNull()

    const child = calls.find(c => c.code === '1.1')!
    expect(child.parent_id).toBe('id-1')

    const leaf = calls.find(c => c.code === '1.1.01.01')!
    expect(leaf.parent_id).toBe('id-1.1.01')
  })
})
