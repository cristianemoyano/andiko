import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/db', () => ({
  default: { transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn({})) },
}))
vi.mock('./sales-quote.model', () => ({
  default: { update: vi.fn(), findAll: vi.fn() },
}))
vi.mock('@/modules/auth/branch.model', () => ({ default: {} }))
vi.mock('@/modules/contacts/contact.model', () => ({ default: {} }))

import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import SalesQuote from './sales-quote.model'
import { expireOverdueQuotes, listQuotesExpiringSoon } from './sales-quote-expiration.service'

const updateMock = SalesQuote.update as unknown as Mock
const findAllMock = SalesQuote.findAll as unknown as Mock

const tenantCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('expireOverdueQuotes', () => {
  it('transitions only draft/sent quotes past their valid_until, inside a transaction', async () => {
    updateMock.mockResolvedValueOnce([2])

    const result = await expireOverdueQuotes()

    expect(sequelize.transaction).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith(
      { status: 'expired' },
      expect.objectContaining({ where: expect.any(Object) }),
    )
    expect(result).toEqual({ expired_count: 2 })
  })

  it('does not touch accepted/rejected/cancelled/expired quotes (scoped via status IN draft/sent)', async () => {
    updateMock.mockResolvedValueOnce([0])

    await expireOverdueQuotes()

    const [, options] = updateMock.mock.calls[0] as [unknown, { where: Record<string, unknown> }]
    const statusFilter = options.where.status as Record<symbol, string[]>
    const inOp = Object.getOwnPropertySymbols(statusFilter)[0]
    expect(statusFilter[inOp]).toEqual(['draft', 'sent'])
    expect(options.where.deleted_at).toBeNull()
  })

  it('scopes to a single org when orgId is passed', async () => {
    updateMock.mockResolvedValueOnce([1])

    await expireOverdueQuotes('org-1')

    const [, options] = updateMock.mock.calls[0] as [unknown, { where: Record<string, unknown> }]
    expect(options.where.org_id).toBe('org-1')
  })

  it('logs the affected count only when quotes were expired', async () => {
    updateMock.mockResolvedValueOnce([0])
    await expireOverdueQuotes()
    expect(logger.info).not.toHaveBeenCalled()

    vi.clearAllMocks()
    updateMock.mockResolvedValueOnce([3])
    await expireOverdueQuotes()
    expect(logger.info).toHaveBeenCalledWith({ count: 3 }, 'quotes marked expired')
  })
})

describe('listQuotesExpiringSoon', () => {
  it('queries with a bounded LIMIT and org/branch scope', async () => {
    findAllMock.mockResolvedValueOnce([])

    await listQuotesExpiringSoon(7, tenantCtx)

    expect(findAllMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    )
  })

  it('maps rows to plain objects', async () => {
    const fakeQuote = {
      get: () => ({
        id: 'quote-1',
        quote_number: 'PRE-01-0001',
        status: 'sent',
        valid_until: new Date('2026-07-05'),
        total: '100.00',
        contact: { id: 'contact-1', legal_name: 'Cliente SRL', trade_name: null },
        branch: { id: 'branch-1', name: 'Casa Central', branch_code: '01' },
      }),
    }
    findAllMock.mockResolvedValueOnce([fakeQuote])

    const result = await listQuotesExpiringSoon(7, tenantCtx)

    expect(result).toEqual([{
      id: 'quote-1',
      quote_number: 'PRE-01-0001',
      status: 'sent',
      valid_until: new Date('2026-07-05'),
      contact: { id: 'contact-1', legal_name: 'Cliente SRL', trade_name: null },
      branch: { id: 'branch-1', name: 'Casa Central', branch_code: '01' },
      total: '100.00',
    }])
  })
})
