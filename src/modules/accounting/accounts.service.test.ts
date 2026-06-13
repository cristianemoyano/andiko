import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UniqueConstraintError } from 'sequelize'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./chart-seed', () => ({ seedDefaultChartOfAccounts: vi.fn() }))

const { accountFindOne, accountCreate, accountCount, lineCount } = vi.hoisted(() => ({
  accountFindOne: vi.fn(),
  accountCreate: vi.fn(),
  accountCount: vi.fn(),
  lineCount: vi.fn(),
}))
vi.mock('./account.model', () => ({
  default: { findOne: accountFindOne, create: accountCreate, count: accountCount },
}))
vi.mock('./journal-entry-line.model', () => ({ default: { count: lineCount } }))

import { createAccount, deleteAccount } from './accounts.service'

const ctx: TenantContext = { orgId: 'org-1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }

describe('accounting/accounts.service createAccount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps unique violations to DUPLICATE_CODE', async () => {
    accountCreate.mockRejectedValue(new UniqueConstraintError({ errors: [] }))
    await expect(
      createAccount({ code: '1.1.01.01', name: 'Caja', type: 'asset', is_postable: true, is_active: true }, ctx, 'actor-1'),
    ).rejects.toThrow('DUPLICATE_CODE')
  })

  it('rejects a parent that does not belong to the org', async () => {
    accountFindOne.mockResolvedValue(null)
    await expect(
      createAccount({ code: '1.1.01.02', name: 'Bancos', type: 'asset', parent_id: 'ghost', is_postable: true, is_active: true }, ctx, 'actor-1'),
    ).rejects.toThrow('PARENT_NOT_FOUND')
  })
})

describe('accounting/accounts.service deleteAccount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks deleting an account with movements', async () => {
    accountFindOne.mockResolvedValue({ id: 'a1', update: vi.fn(), destroy: vi.fn() })
    lineCount.mockResolvedValue(3)
    await expect(deleteAccount('a1', ctx, 'actor-1')).rejects.toThrow('ACCOUNT_HAS_MOVEMENTS')
  })

  it('blocks deleting an account with child accounts', async () => {
    accountFindOne.mockResolvedValue({ id: 'a1', update: vi.fn(), destroy: vi.fn() })
    lineCount.mockResolvedValue(0)
    accountCount.mockResolvedValue(2)
    await expect(deleteAccount('a1', ctx, 'actor-1')).rejects.toThrow('ACCOUNT_HAS_CHILDREN')
  })

  it('soft-deletes a leaf account with no movements', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const destroy = vi.fn().mockResolvedValue(undefined)
    accountFindOne.mockResolvedValue({ id: 'a1', update, destroy })
    lineCount.mockResolvedValue(0)
    accountCount.mockResolvedValue(0)

    await deleteAccount('a1', ctx, 'actor-1')

    expect(update).toHaveBeenCalledWith({ deleted_by: 'actor-1' })
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
