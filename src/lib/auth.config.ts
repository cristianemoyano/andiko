import type { NextAuthConfig } from 'next-auth'

// Edge-compatible config — no Node.js imports (no Sequelize, no pg, no bcryptjs)
// JWT/session callbacks live in auth.ts (Node) so impersonation can load users from DB.
export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname
      const isPublic =
        pathname === '/' ||
        ['/login', '/forgot-password', '/reset-password', '/api/auth', '/api/v1/pos', '/api/admin'].some((p) =>
          pathname.startsWith(p),
        )
      return isPublic || !!auth?.user
    },
  },
  providers: [],
}
