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

  // File storage. The service is vendor-agnostic. `s3` is the production backend; `gdrive`
  // is a dev/staging backend (Google Drive via a service account, bytes proxied through the
  // app) so contributors don't need AWS credentials. The platform uses a single bucket/folder
  // and isolates tenants by key prefix (org_id/...).
  // S3_* are required in production when provider=s3; GDRIVE_* are required when provider=gdrive.
  FILE_STORAGE_PROVIDER: z.enum(['s3', 'gdrive']).default('s3'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Optional override for S3-compatible stores (MinIO, Cloudflare R2, etc.).
  S3_ENDPOINT: z.string().url().optional(),
  // Google Drive backend (dev/staging). Base64 of a service-account key JSON + parent folder id.
  GDRIVE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GDRIVE_FOLDER_ID: z.string().optional(),
  // Hard cap on a single upload, enforced at request validation and re-checked on complete.
  FILE_MAX_BYTES: z.coerce.number().int().positive().default(26_214_400), // 25 MiB
})
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === 'production' && val.FILE_STORAGE_PROVIDER === 's3') {
      const required = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const
      for (const key of required) {
        if (!val[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when FILE_STORAGE_PROVIDER=s3 in production`,
          })
        }
      }
    }
    if (val.FILE_STORAGE_PROVIDER === 'gdrive') {
      const required = ['GDRIVE_SERVICE_ACCOUNT_JSON', 'GDRIVE_FOLDER_ID'] as const
      for (const key of required) {
        if (!val[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when FILE_STORAGE_PROVIDER=gdrive`,
          })
        }
      }
    }
  })

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data
