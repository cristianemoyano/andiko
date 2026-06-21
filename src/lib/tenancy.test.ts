import { describe, expect, it } from 'vitest'
import { Op } from 'sequelize'
import {
  TenancyError,
  TENANCY_ERROR_CODES,
  whereAllowedBranchRecords,
  type TenantContext,
} from './tenancy'

const ctx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: 'branch-a',
  allowedBranchIds: ['branch-a', 'branch-b'],
}

describe('whereAllowedBranchRecords', () => {
  it('scopes list queries to allowed branch ids', () => {
    expect(whereAllowedBranchRecords(ctx, { is_active: true })).toEqual({
      is_active: true,
      org_id: 'org-1',
      id: { [Op.in]: ['branch-a', 'branch-b'] },
    })
  })

  it('preserves an explicit branch id instead of overwriting it with Op.in', () => {
    expect(whereAllowedBranchRecords(ctx, { id: 'branch-b' })).toEqual({
      org_id: 'org-1',
      id: 'branch-b',
    })
  })

  it('rejects an explicit branch id outside the allowed list', () => {
    expect(() => whereAllowedBranchRecords(ctx, { id: 'branch-z' })).toThrow(TenancyError)
    try {
      whereAllowedBranchRecords(ctx, { id: 'branch-z' })
    } catch (err) {
      expect(err).toBeInstanceOf(TenancyError)
      expect((err as TenancyError).code).toBe(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
    }
  })
})
