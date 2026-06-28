import { describe, expect, it } from 'vitest'
import { Op } from 'sequelize'
import {
  TenancyError,
  TENANCY_ERROR_CODES,
  orgContextRequiredResponse,
  resolveTenantContext,
  tenancyErrorResponse,
  whereAllowedBranchRecords,
  type TenantContext,
} from './tenancy'
import type { AuthedSession } from '@/lib/session-actor'

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

describe('tenancy route helpers', () => {
  it('returns 422 for missing org context', async () => {
    const result = await resolveTenantContext({
      role: 'admin',
      realRole: 'admin',
      orgId: null,
      branchId: null,
      orgRoleId: null,
      actingOrgId: null,
      realOrgId: null,
      realBranchId: null,
      impersonation: null,
    } as AuthedSession['user'])
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(422)
    }
  })

  it('maps TenancyError to structured response', () => {
    const resp = tenancyErrorResponse(new TenancyError(TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED))
    expect(resp?.status).toBe(422)
  })

  it('orgContextRequiredResponse uses shared message', async () => {
    const resp = orgContextRequiredResponse()
    const body = await resp.json() as { code: string }
    expect(body.code).toBe(TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED)
  })
})
