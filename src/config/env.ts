import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().default('http://localhost:3000'),
  MIGRATION_SECRET: z.string().min(32).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data
