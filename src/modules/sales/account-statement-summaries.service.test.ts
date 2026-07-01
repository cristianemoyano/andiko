import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('@/lib/db', () => ({
  default: {
    query: vi.fn(),
  },
}))

import sequelize from '@/lib/db'
import { listAccountStatementSummaries } from './account-statement-summaries.service'

const tenantCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

const queryMock = sequelize.query as unknown as Mock

function mockRows(rows: unknown[], count = rows.length) {
  queryMock.mockResolvedValueOnce(rows)
  queryMock.mockResolvedValueOnce([{ count: String(count) }])
}

const baseRow = {
  contact_id: 'contact-1',
  legal_name: 'Cliente SRL',
  trade_name: 'Cliente',
  cuit: '30-11111111-1',
  invoices_count: 3,
  total_invoiced: '300.00',
  total_paid: '180.00',
  balance: '120.00',
  overdue_balance: '0.00',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listAccountStatementSummaries', () => {
  it('maps rows with normalized money strings and debt status', async () => {
    mockRows([
      { ...baseRow, balance: '120', overdue_balance: '60' },
      { ...baseRow, contact_id: 'contact-2', legal_name: 'Otro SA', balance: '50.00', overdue_balance: '0.00' },
      { ...baseRow, contact_id: 'contact-3', legal_name: 'Sin Deuda SA', balance: '0.00', overdue_balance: '0.00' },
    ])

    const result = await listAccountStatementSummaries(
      { page: 1, limit: 20, only_with_balance: false },
      tenantCtx,
    )

    expect(result.data).toHaveLength(3)
    expect(result.data[0]).toMatchObject({
      contact_id: 'contact-1',
      balance: '120.00',
      overdue_balance: '60.00',
      debt_status: 'overdue',
    })
    expect(result.data[1]).toMatchObject({ debt_status: 'with_balance', balance: '50.00' })
    expect(result.data[2]).toMatchObject({ debt_status: 'up_to_date', balance: '0.00' })
    expect(result.total).toBe(3)
    expect(result.page).toBe(1)
  })

  it('scopes by org and open receivable statuses only', async () => {
    mockRows([])

    await listAccountStatementSummaries({ page: 1, limit: 20, only_with_balance: true }, tenantCtx)

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('i.org_id = :orgId')
    expect(sql).toContain('i.status IN (:openStatuses)')
    expect(sql).toContain('i.deleted_at IS NULL')
    expect(options.replacements.orgId).toBe('org-1')
    expect(options.replacements.openStatuses).toEqual(['issued', 'partially_paid'])
  })

  it('filters by allowed branches when the context restricts them', async () => {
    mockRows([])

    await listAccountStatementSummaries(
      { page: 1, limit: 20, only_with_balance: true },
      { ...tenantCtx, allowedBranchIds: ['branch-1', 'branch-2'] },
    )

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('i.branch_id IN (:branchIds)')
    expect(options.replacements.branchIds).toEqual(['branch-1', 'branch-2'])
  })

  it('does not add a branch filter for sys-admin (empty allowed branches)', async () => {
    mockRows([])

    await listAccountStatementSummaries({ page: 1, limit: 20, only_with_balance: true }, tenantCtx)

    const [sql] = queryMock.mock.calls[0] as [string]
    expect(sql).not.toContain('i.branch_id IN')
  })

  it('adds a HAVING clause when only_with_balance is true and omits it when false', async () => {
    mockRows([])
    await listAccountStatementSummaries({ page: 1, limit: 20, only_with_balance: true }, tenantCtx)
    const [sqlWith] = queryMock.mock.calls[0] as [string]
    expect(sqlWith).toContain('HAVING')

    vi.clearAllMocks()
    mockRows([])
    await listAccountStatementSummaries({ page: 1, limit: 20, only_with_balance: false }, tenantCtx)
    const [sqlWithout] = queryMock.mock.calls[0] as [string]
    expect(sqlWithout).not.toContain('HAVING')
  })

  it('searches by name or CUIT with a bound ILIKE pattern', async () => {
    mockRows([])

    await listAccountStatementSummaries(
      { page: 1, limit: 20, only_with_balance: true, search: 'acme' },
      tenantCtx,
    )

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('c.legal_name ILIKE :search')
    expect(sql).toContain('c.cuit ILIKE :search')
    expect(options.replacements.search).toBe('%acme%')
  })

  it('paginates with bound limit/offset and a separate count query', async () => {
    mockRows([baseRow], 41)

    const result = await listAccountStatementSummaries(
      { page: 3, limit: 10, only_with_balance: true },
      tenantCtx,
    )

    const [sql, options] = queryMock.mock.calls[0] as [string, { replacements: Record<string, unknown> }]
    expect(sql).toContain('LIMIT :limit OFFSET :offset')
    expect(options.replacements.limit).toBe(10)
    expect(options.replacements.offset).toBe(20)

    const [countSql] = queryMock.mock.calls[1] as [string]
    expect(countSql).toContain('COUNT(*)')
    expect(result.total).toBe(41)
    expect(result.pages).toBe(5)
  })
})
