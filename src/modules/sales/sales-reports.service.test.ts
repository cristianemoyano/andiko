import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { TenancyError, TENANCY_ERROR_CODES, type TenantContext } from '@/lib/tenancy'

vi.mock('@/lib/db', () => ({
  default: {
    query: vi.fn(),
  },
}))

import sequelize from '@/lib/db'
import { getSalesReport, SALES_REPORT_GROUP_LIMIT } from './sales-reports.service'
import type { SalesReportQuery } from './sales-reports.schema'

const tenantCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

const queryMock = sequelize.query as unknown as Mock

const baseQuery: SalesReportQuery = {
  group_by: 'period',
  granularity: 'month',
}

function mockReport(rows: unknown[], totals: Record<string, unknown> = {}) {
  queryMock.mockResolvedValueOnce(rows)
  queryMock.mockResolvedValueOnce([{ documents: 0, subtotal: '0', tax: '0', total: '0', ...totals }])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getSalesReport', () => {
  it('groups by period with the requested granularity and normalizes money', async () => {
    mockReport(
      [
        { group_key: '2026-05-01', label: '05/2026', secondary_label: null, documents: 2, subtotal: '100', tax: '21', total: '121' },
        { group_key: '2026-06-01', label: '06/2026', secondary_label: null, documents: 1, subtotal: '50.5', tax: '10.61', total: '61.11' },
      ],
      { documents: 3, subtotal: '150.5', tax: '31.61', total: '182.11' },
    )

    const result = await getSalesReport({ ...baseQuery, granularity: 'day' }, tenantCtx)

    const [sql] = queryMock.mock.calls[0] as [string]
    expect(sql).toContain("DATE_TRUNC('day', i.issue_date)")
    expect(result.group_by).toBe('period')
    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toMatchObject({ subtotal: '100.00', tax: '21.00', total: '121.00', quantity: null })
    expect(result.totals).toMatchObject({ documents: 3, subtotal: '150.50', tax: '31.61', total: '182.11' })
    expect(result.truncated).toBe(false)
  })

  it('excludes draft and cancelled invoices and scopes by org', async () => {
    mockReport([])

    await getSalesReport(baseQuery, tenantCtx)

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain("i.status IN ('issued', 'partially_paid', 'paid')")
    expect(sql).toContain('i.org_id = :orgId')
    expect(sql).toContain('i.deleted_at IS NULL')
    expect(options.replacements.orgId).toBe('org-1')
  })

  it('applies bound date range filters (to = end of day)', async () => {
    mockReport([])

    const from = new Date('2026-01-01T00:00:00.000Z')
    const to = new Date('2026-01-31T00:00:00.000Z')
    await getSalesReport({ ...baseQuery, from, to }, tenantCtx)

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('i.issue_date >= :from')
    expect(sql).toContain('i.issue_date <= :to')
    expect(options.replacements.from).toEqual(from)
    const boundTo = options.replacements.to as Date
    expect(boundTo.getHours()).toBe(23)
    expect(boundTo.getMinutes()).toBe(59)
  })

  it('filters by allowed branches when the context restricts them', async () => {
    mockReport([])

    await getSalesReport(baseQuery, { ...tenantCtx, allowedBranchIds: ['branch-1', 'branch-2'] })

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('i.branch_id IN (:branchIds)')
    expect(options.replacements.branchIds).toEqual(['branch-1', 'branch-2'])
  })

  it('narrows to a requested branch when it is allowed', async () => {
    mockReport([])

    await getSalesReport(
      { ...baseQuery, branch_id: 'branch-2' },
      { ...tenantCtx, allowedBranchIds: ['branch-1', 'branch-2'] },
    )

    const [, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(options.replacements.branchIds).toEqual(['branch-2'])
  })

  it('rejects a branch outside the allowed list', async () => {
    await expect(
      getSalesReport(
        { ...baseQuery, branch_id: 'branch-x' },
        { ...tenantCtx, allowedBranchIds: ['branch-1'] },
      ),
    ).rejects.toMatchObject({ code: TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED })
    expect(queryMock).not.toHaveBeenCalled()

    await expect(
      getSalesReport(
        { ...baseQuery, branch_id: 'branch-x' },
        { ...tenantCtx, allowedBranchIds: ['branch-1'] },
      ),
    ).rejects.toBeInstanceOf(TenancyError)
  })

  it('allows any branch for sys-admin (empty allowed list)', async () => {
    mockReport([])

    await getSalesReport({ ...baseQuery, branch_id: 'branch-9' }, tenantCtx)

    const [, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(options.replacements.branchIds).toEqual(['branch-9'])
  })

  it('groups by customer ordered by total', async () => {
    mockReport([
      { group_key: 'c-1', label: 'Cliente SRL', secondary_label: 'Cliente', documents: 4, subtotal: '400', tax: '84', total: '484' },
    ])

    const result = await getSalesReport({ ...baseQuery, group_by: 'customer' }, tenantCtx)

    const [sql] = queryMock.mock.calls[0] as [string]
    expect(sql).toContain('LEFT JOIN contacts c ON c.id = i.contact_id')
    expect(sql).toContain('GROUP BY c.id, c.legal_name, c.trade_name')
    expect(result.data[0]).toMatchObject({ label: 'Cliente SRL', total: '484.00', quantity: null })
  })

  it('groups by product via invoice_items with quantity and distinct documents', async () => {
    mockReport(
      [
        { group_key: 'var-1', label: 'Producto A', secondary_label: 'SKU-1', documents: 2, quantity: '5', subtotal: '500', tax: '105', total: '605' },
      ],
      { documents: 2, quantity: '5', subtotal: '500', tax: '105', total: '605' },
    )

    const result = await getSalesReport({ ...baseQuery, group_by: 'product' }, tenantCtx)

    const [sql] = queryMock.mock.calls[0] as [string]
    expect(sql).toContain('FROM invoice_items ii')
    expect(sql).toContain('COUNT(DISTINCT i.id)')
    expect(sql).toContain('LEFT JOIN products p ON p.id = ii.product_id')
    expect(sql).toContain('LEFT JOIN product_variants v ON v.id = ii.variant_id')
    expect(sql).toContain('ii.deleted_at IS NULL')
    expect(result.data[0]).toMatchObject({ quantity: '5.00', total: '605.00' })
    expect(result.totals).toMatchObject({ quantity: '5.00', total: '605.00' })
  })

  it('always bounds the group list and flags truncation at the cap', async () => {
    const rows = Array.from({ length: SALES_REPORT_GROUP_LIMIT }, (_, i) => ({
      group_key: `2026-${i}`, label: `g${i}`, secondary_label: null, documents: 1, subtotal: '1', tax: '0', total: '1',
    }))
    mockReport(rows, { documents: 600, subtotal: '600', tax: '0', total: '600' })

    const result = await getSalesReport(baseQuery, tenantCtx)

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('LIMIT :groupLimit')
    expect(options.replacements.groupLimit).toBe(SALES_REPORT_GROUP_LIMIT)
    expect(result.truncated).toBe(true)
  })
})
