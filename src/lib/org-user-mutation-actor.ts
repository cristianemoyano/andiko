import type { Session } from 'next-auth'
import { resolveActorId } from '@/lib/api-handler'
import type { AuthedSession } from '@/lib/api-handler'
import type { UserRole } from '@/types/roles'

export type OrgUserMutationActor = {
  userId: string
  /** Platform sys-admin (not impersonating) may edit any org user. */
  bypassManagementRules?: boolean
}

type SessionUser = NonNullable<Session['user']> & {
  role: UserRole
  realRole?: UserRole
  impersonation?: { userId: string } | null
}

export function resolveOrgUserMutationActor(session: { user: SessionUser }): OrgUserMutationActor {
  const realRole = session.user.realRole ?? session.user.role
  return {
    userId: resolveActorId(session as AuthedSession),
    bypassManagementRules: realRole === 'sys-admin' && !session.user.impersonation,
  }
}
