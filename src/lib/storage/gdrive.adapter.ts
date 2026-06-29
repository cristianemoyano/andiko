import 'server-only'
import { Readable } from 'node:stream'
import { drive, auth as googleAuth, type drive_v3 } from '@googleapis/drive'
import type { StorageAdapter } from './adapter'
import { signBlobToken } from './blob-token'

const UPLOAD_URL_TTL_SECONDS = 5 * 60
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60
const PROXY_PATH = '/api/v1/storage/blob'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
/** appProperties field name where we store our storage key (value = full key path). */
const STORAGE_KEY_PROPERTY = 'key'

/** Required on all Drive v3 calls — folders must live in a Shared Drive (service accounts have no My Drive quota). */
const SHARED_DRIVE_PARAMS = {
  supportsAllDrives: true,
} as const

const SHARED_DRIVE_LIST_PARAMS = {
  ...SHARED_DRIVE_PARAMS,
  includeItemsFromAllDrives: true,
  corpora: 'allDrives' as const,
}

export type GDriveStorageConfig = {
  /** Decoded service-account key JSON (not base64). */
  serviceAccountJson: string
  folderId: string
}

/**
 * Google Drive backend for dev/staging. Bytes are proxied through `/api/v1/storage/blob`.
 * Our `storage_key` is recorded in the Drive file's `appProperties.key`.
 */
export class GoogleDriveStorageAdapter implements StorageAdapter {
  readonly provider = 'gdrive'
  readonly bucket: string
  private client: drive_v3.Drive | null = null
  private readonly credentials: Record<string, unknown>

  constructor(config: GDriveStorageConfig) {
    this.bucket = config.folderId
    this.credentials = JSON.parse(config.serviceAccountJson) as Record<string, unknown>
  }

  private getClient(): drive_v3.Drive {
    if (this.client) return this.client
    const authClient = new googleAuth.GoogleAuth({ credentials: this.credentials, scopes: [DRIVE_SCOPE] })
    this.client = drive({ version: 'v3', auth: authClient })
    return this.client
  }

  async getUploadUrl(params: { key: string; contentType: string; byteSize: number }) {
    const token = signBlobToken({
      provider: 'gdrive',
      key: params.key,
      mode: 'put',
      exp: Math.floor(Date.now() / 1000) + UPLOAD_URL_TTL_SECONDS,
      contentType: params.contentType,
      byteSize: params.byteSize,
    })
    return {
      url: `${PROXY_PATH}?token=${encodeURIComponent(token)}`,
      method: 'PUT' as const,
      headers: { 'Content-Type': params.contentType },
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    }
  }

  async getDownloadUrl(params: { key: string; downloadFilename?: string; expiresInSeconds?: number }) {
    const expiresIn = params.expiresInSeconds ?? DOWNLOAD_URL_TTL_SECONDS
    const token = signBlobToken({
      provider: 'gdrive',
      key: params.key,
      mode: 'get',
      exp: Math.floor(Date.now() / 1000) + expiresIn,
      filename: params.downloadFilename,
    })
    return {
      url: `${PROXY_PATH}?token=${encodeURIComponent(token)}`,
      expiresInSeconds: expiresIn,
    }
  }

  async putObject(key: string, params: { contentType: string; body: ReadableStream | Buffer }) {
    // Replace any prior object for this key (idempotent retries).
    await this.deleteObject(key)

    const body = Buffer.isBuffer(params.body)
      ? Readable.from(params.body)
      : Readable.fromWeb(params.body as Parameters<typeof Readable.fromWeb>[0])
    await this.getClient().files.create({
      requestBody: {
        name: filenameFromKey(key),
        parents: [this.bucket],
        appProperties: { [STORAGE_KEY_PROPERTY]: key },
      },
      media: { mimeType: params.contentType, body },
      fields: 'id',
      ...SHARED_DRIVE_PARAMS,
    })
  }

  async headObject(key: string) {
    const meta = await this.resolveByKey(key)
    if (!meta) return null
    return { byteSize: Number(meta.size ?? 0), contentType: meta.mimeType ?? null }
  }

  async getObjectStream(key: string) {
    const meta = await this.resolveByKey(key)
    if (!meta?.id) return null
    const res = await this.getClient().files.get(
      { fileId: meta.id, alt: 'media', ...SHARED_DRIVE_PARAMS },
      { responseType: 'stream' },
    )
    const nodeStream = res.data as unknown as Readable
    return {
      stream: Readable.toWeb(nodeStream) as unknown as ReadableStream,
      contentType: meta.mimeType ?? null,
      byteSize: meta.size != null ? Number(meta.size) : null,
    }
  }

  async deleteObject(key: string): Promise<void> {
    const meta = await this.resolveByKey(key)
    if (!meta?.id) return
    await this.getClient().files.delete({ fileId: meta.id, ...SHARED_DRIVE_PARAMS })
  }

  private async resolveByKey(key: string): Promise<drive_v3.Schema$File | null> {
    const res = await this.getClient().files.list({
      q: `${driveAppPropertyQuery(STORAGE_KEY_PROPERTY, key)} and trashed = false`,
      fields: 'files(id, size, mimeType)',
      pageSize: 1,
      ...SHARED_DRIVE_LIST_PARAMS,
    })
    return res.data.files?.[0] ?? null
  }
}

/** Escape literals for Google Drive `q` search strings (' and \ must be escaped). */
function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Search for a custom app property by name + value (not by value alone). */
function driveAppPropertyQuery(propertyName: string, propertyValue: string): string {
  return `appProperties has { key='${escapeDriveQueryLiteral(propertyName)}' and value='${escapeDriveQueryLiteral(propertyValue)}' }`
}

function filenameFromKey(key: string): string {
  return key.split('/').pop() || key
}

/** Maps known Drive API failures to a short code for the blob proxy route. */
export function mapGDriveError(err: unknown): string | null {
  const message = extractErrorMessage(err)
  if (!message) return null
  if (/service accounts do not have storage quota/i.test(message)) {
    return 'La carpeta debe estar en una Unidad compartida (Shared Drive) de Google Workspace, con la cuenta de servicio como miembro — no alcanza compartir una carpeta de Mi unidad.'
  }
  return message
}

function extractErrorMessage(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const e = err as { message?: string; cause?: { message?: string } }
  return e.cause?.message ?? e.message ?? null
}
