import 'server-only'
import { env } from '@/config/env'
import { S3StorageAdapter } from './s3.adapter'

/**
 * Vendor-agnostic object storage. The file service speaks only this interface;
 * concrete backends (S3, future GCS/Azure/MinIO) live behind {@link getStorageAdapter}.
 *
 * The bytes always live in the backend — the database only keeps metadata. Uploads and
 * downloads use short-lived presigned URLs so the browser transfers bytes directly to the
 * backend (no proxying through the Next.js serverless runtime, which caps request bodies).
 */
export interface StorageAdapter {
  /** Name persisted on the file row (`files.storage_provider`). */
  readonly provider: string
  /** Bucket/container persisted on the file row (`files.storage_bucket`). */
  readonly bucket: string

  /** Presigned PUT the browser uses to upload the object. */
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

  /** Presigned GET the browser uses to download the object. */
  getDownloadUrl(params: {
    key: string
    downloadFilename?: string
    expiresInSeconds?: number
  }): Promise<{ url: string; expiresInSeconds: number }>

  /** Object metadata, or `null` when the object does not exist (used to confirm uploads). */
  headObject(key: string): Promise<{ byteSize: number; contentType: string | null } | null>

  /** Hard-delete the object from the backend. */
  deleteObject(key: string): Promise<void>
}

let cached: StorageAdapter | null = null

/**
 * Resolves the storage backend. Currently env-driven (single platform bucket); the
 * `provider` seam is where per-org/own backends will plug in later without touching callers.
 */
export function getStorageAdapter(
  provider: typeof env.FILE_STORAGE_PROVIDER = env.FILE_STORAGE_PROVIDER,
): StorageAdapter {
  switch (provider) {
    case 's3':
      if (!cached) cached = new S3StorageAdapter()
      return cached
    default: {
      // Exhaustiveness guard — adding a provider to the enum forces a case here.
      const never: never = provider
      throw new Error(`Unsupported FILE_STORAGE_PROVIDER: ${String(never)}`)
    }
  }
}
