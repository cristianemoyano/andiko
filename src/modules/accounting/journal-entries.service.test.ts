import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { transactionMock, accountFindAll, entryCreate, entryFindOne, lineBulkCreate, lineDestroy, branchFindAll } = vi.hoisted(() => {
  const fakeTransaction = { LOCK: { UPDATE: 'UPDATE' } }
  return {
    transactionMock: vi.fn(async (fn: unknown) => (fn as (t: unknown) => unknown)(fakeTransaction)),
    accountFindAll: vi.fn(),
    entryCreate: vi.fn(),
    entryFindOne: vi.fn(),
    lineBulkCreate: vi.fn(),
    lineDestroy: vi.fn(),
    branchFindAll: vi.fn(),
  }
})
vi.mock('@/lib/db', () => ({ default: { transaction: transactionMock } }))
vi.mock('./account.model', () => ({ default: { findAll: accountFindAll } }))
vi.mock('./journal-entry.model', () => ({
  default: { create: entryCreate, findOne: entryFindOne },
  JOURNAL_ENTRY_STATUSES: ['draft', 'posted'],
}))
vi.mock('./journal-entry-line.model', () => ({ default: { bulkCreate: lineBulkCreate, destroy: lineDestroy } }))
vi.mock('@/modules/auth/branch.model', () => ({ default: { findAll: branchFindAll } }))

vi.mock('./accounting-associations', () => ({ ensureAccountingAssociations: vi.fn() }))
vi.mock('./accounting.utils', () => ({ nextEntryNumber: vi.fn(async () => 'AS-000001') }))

import {
  createEntry,
  postEntry,
} from './journal-entries.service'

const ctx: TenantContext = { orgId: 'org-1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }

function postableAccounts(ids: string[]) {
  accountFindAll.mockResolvedValue(ids.map(id => ({ id, is_postable: true, is_active: true })))
}

describe('accounting/journal-entries.service createEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    entryCreate.mockResolvedValue({ id: 'e1' })
    entryFindOne.mockResolvedValue({ id: 'e1', entry_number: 'AS-000001' })
    lineBulkCreate.mockResolvedValue([])
  })

  it('creates a balanced entry and computes totals', async () => {
    postableAccounts(['acc-1', 'acc-2'])

    await createEntry(
      {
        entry_date: '2026-06-13',
        description: 'Venta de prueba',
        lines: [
          { account_id: 'acc-1', debit: 121, credit: 0, sort_order: 0 },
          { account_id: 'acc-2', debit: 0, credit: 121, sort_order: 1 },
        ],
      },
      ctx,
      'actor-1',
    )

    expect(entryCreate).toHaveBeenCalledTimes(1)
    const createArg = entryCreate.mock.calls[0]![0]
    expect(createArg).toMatchObject({
      entry_number: 'AS-000001',
      status: 'draft',
      total_debit: '121.00',
      total_credit: '121.00',
      org_id: 'org-1',
    })
    expect(lineBulkCreate).toHaveBeenCalledTimes(1)
  })

  it('rejects an unbalanced entry', async () => {
    postableAccounts(['acc-1', 'acc-2'])
    await expect(
      createEntry(
        {
          entry_date: '2026-06-13',
          description: null,
          lines: [
            { account_id: 'acc-1', debit: 100, credit: 0, sort_order: 0 },
            { account_id: 'acc-2', debit: 0, credit: 90, sort_order: 1 },
          ],
        },
        ctx,
        'actor-1',
      ),
    ).rejects.toThrow('ENTRY_NOT_BALANCED')
    expect(entryCreate).not.toHaveBeenCalled()
  })

  it('rejects posting to a non-postable account', async () => {
    accountFindAll.mockResolvedValue([
      { id: 'acc-1', is_postable: true, is_active: true },
      { id: 'acc-2', is_postable: false, is_active: true },
    ])
    await expect(
      createEntry(
        {
          entry_date: '2026-06-13',
          description: null,
          lines: [
            { account_id: 'acc-1', debit: 50, credit: 0, sort_order: 0 },
            { account_id: 'acc-2', debit: 0, credit: 50, sort_order: 1 },
          ],
        },
        ctx,
        'actor-1',
      ),
    ).rejects.toThrow('ACCOUNT_NOT_POSTABLE')
  })

  it('rejects an unknown account', async () => {
    accountFindAll.mockResolvedValue([{ id: 'acc-1', is_postable: true, is_active: true }])
    await expect(
      createEntry(
        {
          entry_date: '2026-06-13',
          description: null,
          lines: [
            { account_id: 'acc-1', debit: 50, credit: 0, sort_order: 0 },
            { account_id: 'ghost', debit: 0, credit: 50, sort_order: 1 },
          ],
        },
        ctx,
        'actor-1',
      ),
    ).rejects.toThrow('ACCOUNT_NOT_FOUND')
  })

  it('rejects a branch the user cannot access', async () => {
    postableAccounts(['acc-1', 'acc-2'])
    branchFindAll.mockResolvedValue([{ id: 'branch-x' }])
    const scopedCtx: TenantContext = { ...ctx, allowedBranchIds: ['branch-allowed'] }
    await expect(
      createEntry(
        {
          entry_date: '2026-06-13',
          description: null,
          lines: [
            { account_id: 'acc-1', branch_id: 'branch-x', debit: 50, credit: 0, sort_order: 0 },
            { account_id: 'acc-2', debit: 0, credit: 50, sort_order: 1 },
          ],
        },
        scopedCtx,
        'actor-1',
      ),
    ).rejects.toThrow('BRANCH_NOT_ALLOWED')
  })
})

describe('accounting/journal-entries.service postEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts a balanced draft entry', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    entryFindOne
      .mockResolvedValueOnce({ id: 'e1', status: 'draft', total_debit: '100.00', total_credit: '100.00', update })
      .mockResolvedValueOnce({ id: 'e1', status: 'posted' })

    await postEntry('e1', ctx, 'actor-1')

    expect(update).toHaveBeenCalledWith({ status: 'posted', updated_by: 'actor-1' })
  })

  it('refuses to re-post an already posted entry', async () => {
    ;(entryFindOne as Mock).mockResolvedValueOnce({ id: 'e1', status: 'posted', total_debit: '100.00', total_credit: '100.00', update: vi.fn() })
    await expect(postEntry('e1', ctx, 'actor-1')).rejects.toThrow('ENTRY_ALREADY_POSTED')
  })
})
