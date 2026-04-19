import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { authConfig } from './auth.config'
import { findUserByEmail, validatePassword } from '@/modules/auth/auth.service'
import logger from './logger'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

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
        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
})
