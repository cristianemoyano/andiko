import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().default('http://localhost:3000'),
  MIGRATION_SECRET: z.string().min(32).optional(),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),

  AFIP_MODE: z.enum(['stub', 'homologacion', 'produccion']).default('stub'),

  // Hard cap on a single upload, enforced at request validation and on the storage proxy.
  // Backend credentials live in platform_settings (sys-admin), not env vars.
  FILE_MAX_BYTES: z.coerce.number().int().positive().default(26_214_400), // 25 MiB
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data
