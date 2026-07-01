import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'
import { TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'

vi.mock('@/lib/db', () => ({
  default: {
    query: vi.fn(),
  },
}))

import sequelize from '@/lib/db'
import { getReceivablesAging } from './receivables-aging.service'

const tenantCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

const queryMock = sequelize.query as unknown as Mock

const baseRow = {
  contact_id: 'contact-1',
  legal_name: 'Cliente SRL',
  trade_name: 'Cliente',
  cuit: '30-11111111-1',
  invoices_count: 2,
  current: '0.00',
  bucket_1_30: '50.00',
  bucket_31_60: '0.00',
  bucket_61_90: '0.00',
  bucket_90_plus: '0.00',
  balance: '50.00',
}

const baseTotalsRow = {
  invoices_count: 2,
  current: '0.00',
  bucket_1_30: '50.00',
  bucket_31_60: '0.00',
  bucket_61_90: '0.00',
  bucket_90_plus: '0.00',
  balance: '50.00',
}

function mockCalls(rows: unknown[], count = rows.length, totals: unknown = baseTotalsRow) {
  queryMock.mockResolvedValueOnce(rows)
  queryMock.mockResolvedValueOnce([{ count: String(count) }])
  queryMock.mockResolvedValueOnce([totals])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getReceivablesAging', () => {
  it('maps rows with normalized money strings per bucket', async () => {
    mockCalls([baseRow])

    const result = await getReceivablesAging({ page: 1, limit: 20 }, tenantCtx)

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      contact_id: 'contact-1',
      current: '0.00',
      bucket_1_30: '50.00',
      bucket_31_60: '0.00',
      bucket_61_90: '0.00',
      bucket_90_plus: '0.00',
      balance: '50.00',
    })
    expect(result.totals).toMatchObject({
      invoices_count: 2,
      bucket_1_30: '50.00',
      balance: '50.00',
    })
    expect(result.total).toBe(1)
  })

  it('scopes by org, open receivable statuses only, and always applies HAVING balance > 0', async () => {
    mockCalls([])

    await getReceivablesAging({ page: 1, limit: 20 }, tenantCtx)

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('i.org_id = :orgId')
    expect(sql).toContain('i.status IN (:openStatuses)')
    expect(sql).toContain('i.deleted_at IS NULL')
    expect(sql).toContain('HAVING COALESCE(SUM(CAST(i.balance AS NUMERIC)), 0) > 0')
    expect(options.replacements.orgId).toBe('org-1')
    expect(options.replacements.openStatuses).toEqual(['issued', 'partially_paid'])
  })

  it('computes bucket ranges via EXTRACT(DAY FROM NOW() - due_date)', async () => {
    mockCalls([])

    await getReceivablesAging({ page: 1, limit: 20 }, tenantCtx)

    const [sql] = queryMock.mock.calls[0] as [string]
    expect(sql).toContain('BETWEEN 0 AND 30')
    expect(sql).toContain('BETWEEN 31 AND 60')
    expect(sql).toContain('BETWEEN 61 AND 90')
    expect(sql).toContain('EXTRACT(DAY FROM NOW() - i.due_date) > 90')
  })

  it('filters by allowed branches when the context restricts them', async () => {
    mockCalls([])

    await getReceivablesAging(
      { page: 1, limit: 20 },
      { ...tenantCtx, allowedBranchIds: ['branch-1', 'branch-2'] },
    )

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('i.branch_id IN (:branchIds)')
    expect(options.replacements.branchIds).toEqual(['branch-1', 'branch-2'])
  })

  it('filters by an explicit branch_id when provided', async () => {
    mockCalls([])

    await getReceivablesAging({ page: 1, limit: 20, branch_id: 'branch-1' }, tenantCtx)

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('i.branch_id = :branchId')
    expect(options.replacements.branchId).toBe('branch-1')
  })

  it('throws BRANCH_NOT_ALLOWED when branch_id is outside the allowed set', async () => {
    await expect(
      getReceivablesAging(
        { page: 1, limit: 20, branch_id: 'branch-x' },
        { ...tenantCtx, allowedBranchIds: ['branch-1'] },
      ),
    ).rejects.toMatchObject(new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED))
  })

  it('searches by name or CUIT with a bound ILIKE pattern', async () => {
    mockCalls([])

    await getReceivablesAging({ page: 1, limit: 20, search: 'acme' }, tenantCtx)

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('c.legal_name ILIKE :search')
    expect(sql).toContain('c.cuit ILIKE :search')
    expect(options.replacements.search).toBe('%acme%')
  })

  it('paginates with bound limit/offset and a separate count query', async () => {
    mockCalls([baseRow], 41)

    const result = await getReceivablesAging({ page: 3, limit: 10 }, tenantCtx)

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('LIMIT :limit OFFSET :offset')
    expect(options.replacements.limit).toBe(10)
    expect(options.replacements.offset).toBe(20)

    const [countSql] = queryMock.mock.calls[1] as [string]
    expect(countSql).toContain('COUNT(*)')
    expect(result.total).toBe(41)
    expect(result.pages).toBe(5)
  })

  it('returns zero totals when there are no rows', async () => {
    queryMock.mockResolvedValueOnce([])
    queryMock.mockResolvedValueOnce([{ count: '0' }])
    queryMock.mockResolvedValueOnce([])

    const result = await getReceivablesAging({ page: 1, limit: 20 }, tenantCtx)

    expect(result.totals).toEqual({
      invoices_count: 0,
      current: '0.00',
      bucket_1_30: '0.00',
      bucket_31_60: '0.00',
      bucket_61_90: '0.00',
      bucket_90_plus: '0.00',
      balance: '0.00',
    })
  })
})
