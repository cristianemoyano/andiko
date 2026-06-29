import 'server-only'
import type { StorageProvider } from '@/modules/storage/storage-settings.schema'
import {
  getResolvedGDriveConfig,
  getResolvedDropboxConfig,
  getResolvedS3Config,
} from '@/modules/storage/storage-settings.service'
import { S3StorageAdapter } from './s3.adapter'
import { GoogleDriveStorageAdapter } from './gdrive.adapter'
import { DropboxStorageAdapter } from './dropbox.adapter'

/**
 * Vendor-agnostic object storage. Credentials live in `platform_settings` (sys-admin),
 * same pattern as global SMTP — not in environment variables.
 */
export interface StorageAdapter {
  readonly provider: string
  readonly bucket: string

  getUploadUrl(params: {
    key: string
    contentType: string
    byteSize: number
  }): Promise<{
    url: string
    method: 'PUT'
    headers: Record<string, string>
    expiresInSeconds: number
  }>

  getDownloadUrl(params: {
    key: string
    downloadFilename?: string
    expiresInSeconds?: number
  }): Promise<{ url: string; expiresInSeconds: number }>

  headObject(key: string): Promise<{ byteSize: number; contentType: string | null } | null>

  deleteObject(key: string): Promise<void>

  putObject?(key: string, params: { contentType: string; body: ReadableStream | Buffer }): Promise<void>

  getObjectStream?(
    key: string,
  ): Promise<{ stream: ReadableStream; contentType: string | null; byteSize: number | null } | null>
}

export type { StorageProvider }

const cache = new Map<StorageProvider, StorageAdapter>()

export function clearStorageAdapterCache(): void {
  cache.clear()
}

/**
 * Resolves the storage backend from platform settings. `provider` defaults to the active
 * provider for new uploads; pass a file's persisted `storage_provider` for existing blobs.
 */
export async function getStorageAdapter(provider: StorageProvider): Promise<StorageAdapter | null> {
  const existing = cache.get(provider)
  if (existing) return existing

  let adapter: StorageAdapter | null = null
  if (provider === 's3') {
    const config = await getResolvedS3Config()
    if (config) adapter = new S3StorageAdapter(config)
  } else if (provider === 'gdrive') {
    const config = await getResolvedGDriveConfig()
    if (config) adapter = new GoogleDriveStorageAdapter(config)
  } else {
    const config = await getResolvedDropboxConfig()
    if (config) adapter = new DropboxStorageAdapter(config)
  }

  if (adapter) cache.set(provider, adapter)
  return adapter
}
