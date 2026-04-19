import type { NextAuthConfig } from 'next-auth'

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
      if (user) token.role = (user as { role: string }).role
      return token
    },
    session({ session, token }) {
      if (session.user) session.user.role = token.role as string
      return session
    },
  },
  providers: [],
}
