import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { JWT } from 'next-auth/jwt'
import { z } from 'zod'
import { authConfig } from './auth.config'
import { findUserByEmail, validatePassword } from '@/modules/auth/auth.service'
import { isUuid, loadUserForImpersonation } from '@/modules/auth/impersonation.service'
import User from '@/modules/auth/user.model'
import logger from './logger'
import { clearThrottle, isThrottled, recordFailedAttempt } from './rate-limit'
import { LoginThrottledError } from './login-throttle-error'
import type { UserRole } from '@/types/roles'

const LOGIN_THROTTLE = { maxAttempts: 5, windowSeconds: 15 * 60, lockSeconds: 15 * 60 }

async function rejectFailedLogin(throttleKey: string): Promise<null> {
  const status = await recordFailedAttempt(throttleKey, LOGIN_THROTTLE)
  if (status.blocked) {
    throw new LoginThrottledError(status.retryAfterSeconds)
  }
  return null
}

// How often an existing JWT re-checks `users.is_active` against the DB. Bounds how long a
// deactivated account's session stays usable — bounded staleness in exchange for not hitting
// the DB on every single request (JWT sessions are otherwise fully stateless).
const ACTIVE_RECHECK_SECONDS = 5 * 60

async function isUserActive(userId: string): Promise<boolean> {
  const row = await User.findOne({ where: { id: userId, is_active: true }, attributes: ['id'] })
  return !!row
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

function clearImpersonation(token: JWT) {
  delete token.impersonateUserId
  delete token.impersonateRole
  delete token.impersonateOrgId
  delete token.impersonateBranchId
  delete token.impersonateOrgRoleId
  delete token.impersonateEmail
  delete token.impersonateName
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const throttleKey = `login:${parsed.data.email.toLowerCase()}`
        const throttled = await isThrottled(throttleKey)
        if (throttled.blocked) {
          logger.warn({ email: parsed.data.email }, 'login blocked: too many failed attempts')
          throw new LoginThrottledError(throttled.retryAfterSeconds)
        }

        const user = await findUserByEmail(parsed.data.email)
        if (!user) {
          return rejectFailedLogin(throttleKey)
        }

        const valid = await validatePassword(parsed.data.password, user.password_hash)
        if (!valid) {
          logger.warn({ userId: user.id }, 'failed login attempt')
          return rejectFailedLogin(throttleKey)
        }

        await clearThrottle(throttleKey)
        logger.info({ userId: user.id, email: user.email }, 'user logged in')
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          org_id: user.org_id,
          branch_id: user.branch_id,
          org_role_id: user.org_role_id,
        }
      },
    }),
  ],
  callbacks: {
    authorized: authConfig.callbacks?.authorized,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          role: UserRole
          org_id?: string | null
          branch_id?: string | null
          org_role_id?: string | null
        }
        token.role = u.role ?? 'operator'
        token.orgId = u.org_id ?? null
        token.branchId = u.branch_id ?? null
        token.orgRoleId = u.org_role_id ?? null
        token.actingOrgId = null
        token.activeCheckedAt = Math.floor(Date.now() / 1000)
        clearImpersonation(token)
      }

      // Re-validate the signed-in account still exists and is active, throttled so we don't
      // hit the DB on every request. A deactivated account is cut off within ACTIVE_RECHECK_SECONDS
      // instead of staying valid for the full JWT lifetime.
      if (!user && token.sub) {
        const now = Math.floor(Date.now() / 1000)
        if (now - (token.activeCheckedAt ?? 0) >= ACTIVE_RECHECK_SECONDS) {
          const active = await isUserActive(token.sub)
          if (!active) {
            logger.warn({ userId: token.sub }, 'session revoked: account inactive or deleted')
            return null
          }
          token.activeCheckedAt = now

          if (token.impersonateUserId && !(await isUserActive(token.impersonateUserId))) {
            logger.warn({ userId: token.impersonateUserId }, 'impersonation target inactive, clearing')
            clearImpersonation(token)
          }
        }
      }

      const realRole = token.role as UserRole | undefined

      if (trigger === 'update' && session && typeof session === 'object') {
        const s = session as Record<string, unknown>

        if ('actingOrgId' in s && realRole === 'sys-admin') {
          const v = s.actingOrgId
          token.actingOrgId = v === null || v === '' ? null : String(v)
        }

        if ('impersonation' in s && realRole === 'sys-admin') {
          const imp = s.impersonation
          if (imp === null) {
            clearImpersonation(token)
          } else if (imp && typeof imp === 'object' && imp !== null && 'userId' in imp) {
            const rawId = (imp as { userId?: unknown }).userId
            const targetId = typeof rawId === 'string' && isUuid(rawId) ? rawId.trim() : null

            if (!targetId) {
              logger.warn({}, 'invalid impersonation user id in session update')
              clearImpersonation(token)
            } else if (targetId === token.sub) {
              logger.warn({ userId: targetId }, 'impersonate self blocked')
              clearImpersonation(token)
            } else {
              const target = await loadUserForImpersonation(targetId)
              if (!target || (target.role as UserRole) === 'sys-admin') {
                clearImpersonation(token)
              } else {
                token.impersonateUserId = target.id
                token.impersonateRole = target.role as UserRole
                token.impersonateOrgId = target.org_id ?? null
                token.impersonateBranchId = target.branch_id ?? null
                token.impersonateOrgRoleId = target.org_role_id ?? null
                token.impersonateEmail = target.email
                token.impersonateName = target.name
                token.actingOrgId = null
              }
            }
          }
        }
      }

      if (realRole !== 'sys-admin') {
        token.actingOrgId = null
        clearImpersonation(token)
      }

      return token
    },
    session({ session, token }) {
      if (!session.user) return session

      // JWT strategy does not populate user.id by default — always expose the signed-in account id.
      if (token.sub) session.user.id = token.sub

      const realRole = token.role as UserRole
      session.user.realRole = realRole
      session.user.realOrgId = (token.orgId ?? null) as string | null
      session.user.realBranchId = (token.branchId ?? null) as string | null

      if (token.impersonateUserId && realRole === 'sys-admin') {
        session.user.impersonation = {
          userId: token.impersonateUserId as string,
          email: token.impersonateEmail as string,
          name: token.impersonateName as string,
          role: token.impersonateRole as UserRole,
        }
        session.user.name = token.impersonateName as string
        session.user.email = token.impersonateEmail as string
        session.user.role = token.impersonateRole as UserRole
        session.user.orgId = (token.impersonateOrgId ?? null) as string | null
        session.user.branchId = (token.impersonateBranchId ?? null) as string | null
        session.user.orgRoleId = (token.impersonateOrgRoleId ?? null) as string | null
        session.user.actingOrgId = null
      } else {
        session.user.impersonation = null
        session.user.role = realRole
        session.user.orgId = (token.orgId ?? null) as string | null
        session.user.branchId = (token.branchId ?? null) as string | null
        session.user.orgRoleId = (token.orgRoleId ?? null) as string | null
        session.user.actingOrgId =
          realRole === 'sys-admin' ? ((token.actingOrgId ?? null) as string | null) : null
      }

      return session
    },
  },
})
