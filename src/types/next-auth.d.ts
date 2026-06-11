import type { DefaultSession, DefaultJWT } from 'next-auth'
import type { UserRole } from './roles'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      /** Effective tenant identity (mirrors impersonated user when impersonating). */
      role: UserRole
      orgId: string | null
      branchId: string | null
      /** sys-admin only (when not impersonating): org assumed for ERP writes if account has no org_id */
      actingOrgId: string | null
      /** Role on the signed-in account (never the impersonated role). */
      realRole: UserRole
      realOrgId: string | null
      realBranchId: string | null
      impersonation: null | {
        userId: string
        email: string
        name: string
        role: UserRole
      }
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: UserRole
    orgId: string | null
    branchId: string | null
    actingOrgId: string | null
    impersonateUserId?: string | null
    impersonateRole?: UserRole
    impersonateOrgId?: string | null
    impersonateBranchId?: string | null
    impersonateEmail?: string
    impersonateName?: string
  }
}
