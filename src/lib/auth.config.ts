import type { NextAuthConfig } from 'next-auth'
import type { UserRole } from '@/types/roles'

// Edge-compatible config — no Node.js imports (no Sequelize, no pg, no bcryptjs)
// Used by proxy.ts. Full config with Credentials lives in auth.ts.
export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth, request }) {
      const isPublic = ['/login', '/api/auth'].some((p) =>
        request.nextUrl.pathname.startsWith(p)
      )
      return isPublic || !!auth?.user
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as { role: UserRole; org_id?: string | null; branch_id?: string | null }
        token.role     = u.role ?? 'operator'
        token.orgId    = u.org_id    ?? null
        token.branchId = u.branch_id ?? null
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role     = token.role as UserRole
        session.user.orgId    = (token.orgId    ?? null) as string | null
        session.user.branchId = (token.branchId ?? null) as string | null
      }
      return session
    },
  },
  providers: [],
}
