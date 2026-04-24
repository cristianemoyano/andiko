import { describe, expect, it } from 'vitest'
import { formatDateArg, decString } from './format-utils'
import { assertPrintAccess } from './tenant-guards'
import type { TenantContext } from '@/lib/tenancy'

describe('format-utils', () => {
  it('formatDateArg formats valid date', () => {
    expect(formatDateArg(new Date('2026-04-24T12:00:00Z'))).toMatch(/24/)
  })

  it('decString handles string and number', () => {
    expect(decString('12.50')).toBe('12.50')
    expect(decString(3)).toBe('3')
  })
})

describe('tenant-guards', () => {
  const ctx: TenantContext = {
    orgId: 'org-1',
    userId: 'u1',
    defaultBranchId: 'b1',
    allowedBranchIds: ['b1', 'b2'],
  }

  it('allows matching org and branch', () => {
    expect(() => assertPrintAccess({ org_id: 'org-1', branch_id: 'b1' }, ctx)).not.toThrow()
  })

  it('throws when org mismatches', () => {
    expect(() => assertPrintAccess({ org_id: 'other', branch_id: 'b1' }, ctx)).toThrow('NOT_FOUND')
  })

  it('throws when branch not allowed', () => {
    expect(() => assertPrintAccess({ org_id: 'org-1', branch_id: 'bx' }, ctx)).toThrow('NOT_FOUND')
  })
})
