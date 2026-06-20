import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().default('http://localhost:3000'),
  MIGRATION_SECRET: z.string().min(32).optional(),

  // AFIP / ARCA electronic invoicing. `stub` needs none of the rest; the real
  // clients validate cert/key/CUIT presence at call time (throw AFIP_CERT_NOT_CONFIGURED).
  AFIP_MODE: z.enum(['stub', 'homologacion', 'produccion']).default('stub'),
  AFIP_CUIT: z.string().optional(),
  AFIP_CERT_PATH: z.string().optional(),
  AFIP_KEY_PATH: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data
