import { describe, expect, it } from 'vitest'
import { Op } from 'sequelize'
import type { TenantContext } from '@/lib/tenancy'
import {
  assertSalesOwnScope,
  isWithinSalesOwnScope,
  whereSalesDocumentScope,
  whereSalesOwnScope,
  whereSalesOwnScopeViaInvoice,
  whereSalesOwnScopeViaOrder,
} from './sales-scope'

const baseCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-a',
  defaultBranchId: 'branch-1',
  allowedBranchIds: ['branch-1'],
  salesScopeOwn: false,
}

const scopedCtx: TenantContext = { ...baseCtx, salesScopeOwn: true }

describe('isWithinSalesOwnScope', () => {
  it('allows all documents when scope is off', () => {
    expect(isWithinSalesOwnScope(baseCtx, { salesperson_id: 'other', created_by: 'other' })).toBe(true)
  })

  it('matches salesperson_id', () => {
    expect(isWithinSalesOwnScope(scopedCtx, { salesperson_id: 'user-a', created_by: 'other' })).toBe(true)
    expect(isWithinSalesOwnScope(scopedCtx, { salesperson_id: 'user-b', created_by: 'user-a' })).toBe(false)
  })

  it('falls back to created_by when salesperson_id is null', () => {
    expect(isWithinSalesOwnScope(scopedCtx, { salesperson_id: null, created_by: 'user-a' })).toBe(true)
    expect(isWithinSalesOwnScope(scopedCtx, { salesperson_id: null, created_by: 'user-b' })).toBe(false)
  })
})

describe('assertSalesOwnScope', () => {
  it('throws NOT_FOUND when out of scope', () => {
    expect(() =>
      assertSalesOwnScope(scopedCtx, { salesperson_id: 'user-b', created_by: 'user-b' }),
    ).toThrow('NOT_FOUND')
  })
})

describe('whereSalesOwnScope', () => {
  it('returns empty when scope is off', () => {
    expect(whereSalesOwnScope(baseCtx)).toEqual({})
  })

  it('filters by salesperson or legacy created_by', () => {
    expect(whereSalesOwnScope(scopedCtx)).toEqual({
      [Op.or]: [
        { salesperson_id: 'user-a' },
        { salesperson_id: null, created_by: 'user-a' },
      ],
    })
  })
})

describe('whereSalesDocumentScope', () => {
  it('combines branch and own scope', () => {
    expect(whereSalesDocumentScope(scopedCtx)).toEqual({
      [Op.and]: [
        { org_id: 'org-1', branch_id: { [Op.in]: ['branch-1'] } },
        {
          [Op.or]: [
            { salesperson_id: 'user-a' },
            { salesperson_id: null, created_by: 'user-a' },
          ],
        },
      ],
    })
  })
})

describe('whereSalesOwnScopeViaInvoice', () => {
  it('scopes credit/debit notes through invoice ownership', () => {
    expect(whereSalesOwnScopeViaInvoice(scopedCtx)).toEqual({
      [Op.or]: [
        { invoice_id: null, created_by: 'user-a' },
        { '$invoice.salesperson_id$': 'user-a' },
        {
          invoice_id: { [Op.ne]: null },
          '$invoice.salesperson_id$': null,
          '$invoice.created_by$': 'user-a',
        },
      ],
    })
  })
})

describe('whereSalesOwnScopeViaOrder', () => {
  it('scopes returns through order ownership', () => {
    expect(whereSalesOwnScopeViaOrder(scopedCtx)).toEqual({
      [Op.or]: [
        { created_by: 'user-a' },
        { '$order.salesperson_id$': 'user-a' },
        {
          '$order.salesperson_id$': null,
          '$order.created_by$': 'user-a',
        },
      ],
    })
  })
})
