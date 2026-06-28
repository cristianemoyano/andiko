import { describe, it, expect } from 'vitest'
import { requireAuthedSession, resolveActorId } from './session-actor'
import type { Session } from 'next-auth'

function sessionWith(user: NonNullable<Session['user']>): Session {
  return { user, expires: '2099-01-01T00:00:00.000Z' }
}

describe('requireAuthedSession', () => {
  it('accepts impersonation actor when session.user.id is missing', () => {
    const session = sessionWith({
      email: 'admin@example.com',
      impersonation: {
        userId: 'impersonated-id',
        email: 'user@example.com',
        name: 'User',
        role: 'admin',
      },
      realRole: 'sys-admin',
      role: 'admin',
      orgId: 'org-1',
      branchId: null,
      orgRoleId: null,
      actingOrgId: null,
      realOrgId: null,
      realBranchId: null,
    } as NonNullable<Session['user']>)

    const authed = requireAuthedSession(session)
    expect(authed).not.toBeNull()
    expect(resolveActorId(authed!)).toBe('impersonated-id')
  })

  it('rejects session without actor id', () => {
    expect(requireAuthedSession(null)).toBeNull()
    expect(requireAuthedSession(sessionWith({ email: 'a@b.com' } as NonNullable<Session['user']>))).toBeNull()
  })
})
