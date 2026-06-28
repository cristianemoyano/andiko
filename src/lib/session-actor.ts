import type { Session } from 'next-auth'
import type { UserRole } from '@/types/roles'

export type AuthedSessionUser = NonNullable<Session['user']> & {
  role: UserRole
  orgId: string | null
  branchId: string | null
  orgRoleId: string | null
  actingOrgId: string | null
  realRole: UserRole
}

export type AuthedSession = Session & {
  user: AuthedSessionUser
}

/** Effective actor user id (impersonated user when impersonating). */
export function resolveActorId(session: AuthedSession): string {
  return session.user.impersonation?.userId ?? session.user.id!
}

/** Session guard for /me routes — accepts impersonation actor ids, not only session.user.id. */
export function requireAuthedSession(session: Session | null): AuthedSession | null {
  if (!session?.user) return null
  const actorId = session.user.impersonation?.userId ?? session.user.id
  if (!actorId) return null
  return session as AuthedSession
}
