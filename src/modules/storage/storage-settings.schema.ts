import { z } from 'zod'

export const STORAGE_PROVIDERS = ['s3', 'gdrive', 'dropbox'] as const
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number]

/** Backends that proxy bytes through `/api/v1/storage/blob` (no presigned URLs). */
export const PROXY_STORAGE_PROVIDERS = ['gdrive', 'dropbox'] as const
export type ProxyStorageProvider = (typeof PROXY_STORAGE_PROVIDERS)[number]

/**
 * Global (platform-wide) file storage configuration, managed by sys-admin and stored in
 * the singleton `platform_settings` row. Secrets are encrypted at rest and NEVER returned
 * to the client — GET responses expose only boolean `has_*` flags.
 */

export const storageSettingsUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: z.enum(STORAGE_PROVIDERS).optional(),
    s3_bucket: z.string().max(255).optional(),
    s3_region: z.string().max(64).optional(),
    s3_access_key_id: z.string().max(255).optional(),
    /** Plaintext on write only; omitted / empty → keep existing secret. */
    s3_secret_access_key: z.string().max(1024).optional(),
    s3_endpoint: z.string().max(512).optional().or(z.literal('')),
    /** Base64 of service-account JSON on write only; omitted / empty → keep existing. */
    gdrive_service_account_json: z.string().max(65536).optional(),
    gdrive_folder_id: z.string().max(255).optional(),
    dropbox_app_key: z.string().max(255).optional(),
    /** Plaintext on write only; omitted / empty → keep existing secret. */
    dropbox_app_secret: z.string().max(1024).optional(),
    /** Plaintext on write only; omitted / empty → keep existing token. */
    dropbox_refresh_token: z.string().max(4096).optional(),
    /** Generated access token from App Console (dev); omitted / empty → keep existing. */
    dropbox_access_token: z.string().max(4096).optional(),
    dropbox_root_path: z.string().max(512).optional(),
    /** Explicit clears — empty string alone does not wipe encrypted secrets. */
    clear_dropbox_refresh_token: z.boolean().optional(),
    clear_dropbox_access_token: z.boolean().optional(),
  })
  .strict()

export type StorageSettingsUpdateInput = z.infer<typeof storageSettingsUpdateSchema>

/** Empty body — uses saved platform storage settings. */
export const storageTestSchema = z.object({}).strict()
export type StorageTestInput = z.infer<typeof storageTestSchema>

/** Deletes a sys-admin test upload by storage key. */
export const storageTestDeleteSchema = z
  .object({
    storage_key: z.string().min(1).max(512),
  })
  .strict()
export type StorageTestDeleteInput = z.infer<typeof storageTestDeleteSchema>

/** Shape returned to the client — secrets redacted to boolean flags. */
export interface PublicStorageSettings {
  enabled: boolean
  provider: StorageProvider
  s3_bucket: string
  s3_region: string
  s3_access_key_id: string
  s3_endpoint: string
  has_s3_secret: boolean
  gdrive_folder_id: string
  has_gdrive_credentials: boolean
  dropbox_app_key: string
  has_dropbox_app_secret: boolean
  has_dropbox_refresh_token: boolean
  has_dropbox_access_token: boolean
  dropbox_root_path: string
  /** Copy into Dropbox App Console → Redirect URIs. */
  dropbox_oauth_redirect_uri: string
}

export const DEFAULT_PUBLIC_STORAGE_SETTINGS: PublicStorageSettings = {
  enabled: false,
  provider: 's3',
  s3_bucket: '',
  s3_region: 'us-east-1',
  s3_access_key_id: '',
  s3_endpoint: '',
  has_s3_secret: false,
  gdrive_folder_id: '',
  has_gdrive_credentials: false,
  dropbox_app_key: '',
  has_dropbox_app_secret: false,
  has_dropbox_refresh_token: false,
  has_dropbox_access_token: false,
  dropbox_root_path: '/',
  dropbox_oauth_redirect_uri: '',
}
