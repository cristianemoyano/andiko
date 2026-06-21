import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { JWT } from 'next-auth/jwt'
import { z } from 'zod'
import { authConfig } from './auth.config'
import { findUserByEmail, validatePassword } from '@/modules/auth/auth.service'
import { isUuid, loadUserForImpersonation } from '@/modules/auth/impersonation.service'
import logger from './logger'
import type { UserRole } from '@/types/roles'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

function clearImpersonation(token: JWT) {
  delete token.impersonateUserId
  delete token.impersonateRole
  delete token.impersonateOrgId
  delete token.impersonateBranchId
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

        const user = await findUserByEmail(parsed.data.email)
        if (!user) return null

        const valid = await validatePassword(parsed.data.password, user.password_hash)
        if (!valid) {
          logger.warn({ email: parsed.data.email }, 'failed login attempt')
          return null
        }

        logger.info({ userId: user.id, email: user.email }, 'user logged in')
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          org_id: user.org_id,
          branch_id: user.branch_id,
        }
      },
    }),
  ],
  callbacks: {
    authorized: authConfig.callbacks?.authorized,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as { role: UserRole; org_id?: string | null; branch_id?: string | null }
        token.role = u.role ?? 'operator'
        token.orgId = u.org_id ?? null
        token.branchId = u.branch_id ?? null
        token.actingOrgId = null
        clearImpersonation(token)
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

      if (token.sub) {
        session.user.id = token.sub
      }

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
        session.user.role = token.impersonateRole as UserRole
        session.user.orgId = (token.impersonateOrgId ?? null) as string | null
        session.user.branchId = (token.impersonateBranchId ?? null) as string | null
        session.user.actingOrgId = null
      } else {
        session.user.impersonation = null
        session.user.role = realRole
        session.user.orgId = (token.orgId ?? null) as string | null
        session.user.branchId = (token.branchId ?? null) as string | null
        session.user.actingOrgId =
          realRole === 'sys-admin' ? ((token.actingOrgId ?? null) as string | null) : null
      }

      return session
    },
  },
})
