import type { DefaultSession, DefaultJWT } from 'next-auth'
import type { UserRole } from './roles'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      role: UserRole
      orgId: string | null
      branchId: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: UserRole
    orgId: string | null
    branchId: string | null
  }
}
