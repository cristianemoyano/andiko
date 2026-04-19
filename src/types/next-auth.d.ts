import type { DefaultSession, DefaultJWT } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & { role: string }
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: string
  }
}
