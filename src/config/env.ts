import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().default('http://localhost:3000'),
  MIGRATION_SECRET: z.string().min(32).optional(),

  // AFIP / ARCA electronic invoicing. `stub` needs no credentials; in
  // `homologacion`/`produccion` the certificate + key are stored per-organization
  // (see afip-credentials.service). This only selects the target environment.
  AFIP_MODE: z.enum(['stub', 'homologacion', 'produccion']).default('stub'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data
