import { describe, it, expect } from 'vitest'
import { orgUserCreateSchema, parseOrgUserCreateInput } from '@/modules/auth/org-users.schema'

describe('orgUserCreateSchema', () => {
  const base = {
    email: 'user@example.com',
    firstName: 'Ana',
    lastName: 'García',
    password: 'password123',
    branchIds: ['00000000-0000-4000-8000-000000000001'],
    defaultBranchId: '00000000-0000-4000-8000-000000000001',
  }

  it('requires exactly one branch for branch-admin', () => {
    const result = orgUserCreateSchema.safeParse({
      roleKind: 'builtin',
      role: 'branch-admin',
      ...base,
      branchIds: [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ],
      defaultBranchId: '00000000-0000-4000-8000-000000000001',
    })
    expect(result.success).toBe(false)
  })

  it('accepts branch-admin with one branch', () => {
    const result = orgUserCreateSchema.safeParse({
      roleKind: 'builtin',
      role: 'branch-admin',
      ...base,
    })
    expect(result.success).toBe(true)
  })

  it('accepts custom role assignment', () => {
    const result = orgUserCreateSchema.safeParse({
      roleKind: 'custom',
      orgRoleId: '00000000-0000-4000-8000-000000000099',
      ...base,
    })
    expect(result.success).toBe(true)
  })

  it('rejects legacy operator on create', () => {
    const result = orgUserCreateSchema.safeParse({
      roleKind: 'builtin',
      role: 'operator',
      ...base,
    })
    expect(result.success).toBe(false)
  })

  it('parses legacy name into first and last name', () => {
    const result = parseOrgUserCreateInput({
      roleKind: 'builtin',
      role: 'admin',
      email: 'user@example.com',
      name: 'Ana García',
      password: 'password123',
      branchIds: ['00000000-0000-4000-8000-000000000001'],
      defaultBranchId: '00000000-0000-4000-8000-000000000001',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.firstName).toBe('Ana')
      expect(result.data.lastName).toBe('García')
    }
  })
})
