import 'server-only'
import PlatformSetting from '@/modules/auth/platform-setting.model'
import { decryptSecret, encryptSecret, isEncryptedSecret } from '@/lib/crypto'
import { clearStorageAdapterCache } from '@/lib/storage/adapter'
import type { S3StorageConfig } from '@/lib/storage/s3.adapter'
import type { GDriveStorageConfig } from '@/lib/storage/gdrive.adapter'
import type { DropboxStorageConfig } from '@/lib/storage/dropbox.adapter'
import { getDropboxOAuthRedirectUri } from '@/lib/storage/dropbox-oauth'
import {
  type PublicStorageSettings,
  type StorageProvider,
  type StorageSettingsUpdateInput,
  DEFAULT_PUBLIC_STORAGE_SETTINGS,
} from './storage-settings.schema'

/** Load the singleton row, creating it on first access. */
async function getRow(): Promise<PlatformSetting> {
  const existing = await PlatformSetting.findOne({ where: { singleton: true } })
  if (existing) return existing
  return PlatformSetting.create({ singleton: true })
}

function parseStorageProvider(value: string): StorageProvider {
  if (value === 'gdrive' || value === 'dropbox') return value
  return 's3'
}

function toPublic(row: PlatformSetting): PublicStorageSettings {
  return {
    enabled: row.storage_enabled,
    provider: parseStorageProvider(row.storage_provider),
    s3_bucket: row.s3_bucket,
    s3_region: row.s3_region,
    s3_access_key_id: row.s3_access_key_id,
    s3_endpoint: row.s3_endpoint,
    has_s3_secret: row.s3_secret_access_key_encrypted.length > 0,
    gdrive_folder_id: row.gdrive_folder_id,
    has_gdrive_credentials: row.gdrive_service_account_json_encrypted.length > 0,
    dropbox_app_key: row.dropbox_app_key,
    has_dropbox_app_secret: row.dropbox_app_secret_encrypted.length > 0,
    has_dropbox_refresh_token: row.dropbox_refresh_token_encrypted.length > 0,
    has_dropbox_access_token: row.dropbox_access_token_encrypted.length > 0,
    dropbox_root_path: row.dropbox_root_path,
    dropbox_oauth_redirect_uri: getDropboxOAuthRedirectUri(),
  }
}

/** Client-safe view: never includes secrets. */
export async function getPublicStorageSettings(): Promise<PublicStorageSettings> {
  return toPublic(await getRow())
}

/** Active provider for new uploads (when storage is enabled). */
export async function getActiveStorageProvider(): Promise<StorageProvider | null> {
  const row = await getRow()
  if (!row.storage_enabled) return null
  return parseStorageProvider(row.storage_provider)
}

function decryptField(encrypted: string): string {
  if (!encrypted) return ''
  return decryptSecret(encrypted) ?? ''
}

function encryptField(plaintext: string, existingEncrypted: string): string {
  if (!plaintext) return existingEncrypted
  return isEncryptedSecret(plaintext) ? plaintext : encryptSecret(plaintext)
}

/** Resolved S3 credentials for adapter construction. Server-only. */
export async function getResolvedS3Config(): Promise<S3StorageConfig | null> {
  const row = await getRow()
  const bucket = row.s3_bucket.trim()
  const region = row.s3_region.trim()
  const accessKeyId = row.s3_access_key_id.trim()
  if (!bucket || !region || !accessKeyId) return null
  const secretAccessKey = decryptField(row.s3_secret_access_key_encrypted).trim()
  if (!secretAccessKey) return null
  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint: row.s3_endpoint.trim() || undefined,
  }
}

/** Resolved Google Drive credentials for adapter construction. Server-only. */
export async function getResolvedGDriveConfig(): Promise<GDriveStorageConfig | null> {
  const row = await getRow()
  if (!row.gdrive_folder_id) return null
  const stored = decryptField(row.gdrive_service_account_json_encrypted)
  if (!stored) return null
  try {
    const serviceAccountJson = Buffer.from(stored, 'base64').toString('utf8')
    JSON.parse(serviceAccountJson)
    return { folderId: row.gdrive_folder_id, serviceAccountJson }
  } catch {
    return null
  }
}

/** Resolved Dropbox OAuth credentials for adapter construction. Server-only. */
export async function getResolvedDropboxConfig(): Promise<DropboxStorageConfig | null> {
  const row = await getRow()
  const appKey = row.dropbox_app_key.trim()
  if (!appKey) return null

  const rootPath = normalizeDropboxRootPath(row.dropbox_root_path)
  const accessToken = decryptField(row.dropbox_access_token_encrypted).trim()
  if (accessToken) {
    return { appKey, rootPath, accessToken }
  }

  const appSecret = decryptField(row.dropbox_app_secret_encrypted).trim()
  const refreshToken = decryptField(row.dropbox_refresh_token_encrypted).trim()
  if (!appSecret || !refreshToken) return null
  return { appKey, appSecret, refreshToken, rootPath }
}

function normalizeDropboxRootPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed || trimmed === '/') return '/'
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withSlash.replace(/\/+$/, '') || '/'
}

/**
 * Returns true when storage is enabled and the requested provider has complete credentials.
 * Used before minting upload URLs.
 */
export async function isStorageProviderReady(provider: StorageProvider): Promise<boolean> {
  const row = await getRow()
  if (!row.storage_enabled) return false
  if (provider === 's3') return (await getResolvedS3Config()) !== null
  if (provider === 'gdrive') return (await getResolvedGDriveConfig()) !== null
  return (await getResolvedDropboxConfig()) !== null
}

/** App key + secret saved in DB — required before starting OAuth. */
export async function getResolvedDropboxOAuthCredentials(): Promise<{
  appKey: string
  appSecret: string
} | null> {
  const row = await getRow()
  const appKey = row.dropbox_app_key.trim()
  const appSecret = decryptField(row.dropbox_app_secret_encrypted).trim()
  if (!appKey || !appSecret) return null
  return { appKey, appSecret }
}

/** Persists refresh token after successful Dropbox OAuth callback. */
export async function saveDropboxRefreshTokenFromOAuth(refreshToken: string): Promise<void> {
  const row = await getRow()
  await row.update({
    dropbox_refresh_token_encrypted: encryptSecret(refreshToken.trim()),
    dropbox_access_token_encrypted: '',
  })
  clearStorageAdapterCache()
}

export async function updateStorageSettings(
  input: StorageSettingsUpdateInput,
): Promise<PublicStorageSettings> {
  const row = await getRow()

  const s3_secret_access_key_encrypted = encryptField(
    (input.s3_secret_access_key ?? '').trim(),
    row.s3_secret_access_key_encrypted,
  )
  const gdrive_service_account_json_encrypted = encryptField(
    input.gdrive_service_account_json ?? '',
    row.gdrive_service_account_json_encrypted,
  )
  const dropbox_app_secret_encrypted = encryptField(
    (input.dropbox_app_secret ?? '').trim(),
    row.dropbox_app_secret_encrypted,
  )
  const dropbox_refresh_token_encrypted = input.clear_dropbox_refresh_token
    ? ''
    : encryptField((input.dropbox_refresh_token ?? '').trim(), row.dropbox_refresh_token_encrypted)
  const dropbox_access_token_encrypted = input.clear_dropbox_access_token
    ? ''
    : encryptField((input.dropbox_access_token ?? '').trim(), row.dropbox_access_token_encrypted)

  await row.update({
    storage_enabled: input.enabled ?? row.storage_enabled,
    storage_provider: input.provider ?? row.storage_provider,
    s3_bucket: (input.s3_bucket ?? row.s3_bucket).trim(),
    s3_region: (input.s3_region ?? row.s3_region).trim(),
    s3_access_key_id: (input.s3_access_key_id ?? row.s3_access_key_id).trim(),
    s3_secret_access_key_encrypted,
    s3_endpoint: (input.s3_endpoint ?? row.s3_endpoint).trim(),
    gdrive_service_account_json_encrypted,
    gdrive_folder_id: input.gdrive_folder_id ?? row.gdrive_folder_id,
    dropbox_app_key: (input.dropbox_app_key ?? row.dropbox_app_key).trim(),
    dropbox_app_secret_encrypted,
    dropbox_refresh_token_encrypted,
    dropbox_access_token_encrypted,
    dropbox_root_path: input.dropbox_root_path != null
      ? normalizeDropboxRootPath(input.dropbox_root_path)
      : row.dropbox_root_path,
  })

  clearStorageAdapterCache()
  return toPublic(row)
}

export { DEFAULT_PUBLIC_STORAGE_SETTINGS }
