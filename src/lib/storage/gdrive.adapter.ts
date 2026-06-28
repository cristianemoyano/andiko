import 'server-only'
import { Readable } from 'node:stream'
import { drive, auth as googleAuth, type drive_v3 } from '@googleapis/drive'
import { env } from '@/config/env'
import type { StorageAdapter } from './adapter'
import { signBlobToken } from './blob-token'

const UPLOAD_URL_TTL_SECONDS = 5 * 60
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60
const PROXY_PATH = '/api/v1/storage/blob'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

/**
 * Google Drive backend for dev/staging — no AWS account needed. Drive has no S3-style scoped
 * presigned URLs, so bytes are PROXIED through the app: `getUploadUrl`/`getDownloadUrl` return
 * signed URLs to our `/api/v1/storage/blob` route, which calls `putObject`/`getObjectStream`
 * here. The browser flow is identical to S3 (PUT a url, GET a url).
 *
 * Our `storage_key` is recorded in the Drive file's `appProperties.key`, so head/get/delete
 * resolve key → Drive fileId without any DB schema change.
 */
export class GoogleDriveStorageAdapter implements StorageAdapter {
  readonly provider = 'gdrive'
  readonly bucket: string
  private client: drive_v3.Drive | null = null

  constructor() {
    if (!env.GDRIVE_SERVICE_ACCOUNT_JSON || !env.GDRIVE_FOLDER_ID) {
      throw new Error('GDRIVE_SERVICE_ACCOUNT_JSON and GDRIVE_FOLDER_ID must be set')
    }
    this.bucket = env.GDRIVE_FOLDER_ID
  }

  private getClient(): drive_v3.Drive {
    if (this.client) return this.client
    const json = Buffer.from(env.GDRIVE_SERVICE_ACCOUNT_JSON!, 'base64').toString('utf8')
    const credentials = JSON.parse(json) as Record<string, unknown>
    const authClient = new googleAuth.GoogleAuth({ credentials, scopes: [DRIVE_SCOPE] })
    this.client = drive({ version: 'v3', auth: authClient })
    return this.client
  }

  async getUploadUrl(params: { key: string; contentType: string; byteSize: number }) {
    const token = signBlobToken({
      key: params.key,
      mode: 'put',
      exp: Math.floor(Date.now() / 1000) + UPLOAD_URL_TTL_SECONDS,
      contentType: params.contentType,
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
    const body = Buffer.isBuffer(params.body)
      ? Readable.from(params.body)
      : Readable.fromWeb(params.body as Parameters<typeof Readable.fromWeb>[0])
    await this.getClient().files.create({
      requestBody: {
        name: filenameFromKey(key),
        parents: [this.bucket],
        appProperties: { key },
      },
      media: { mimeType: params.contentType, body },
      fields: 'id',
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
      { fileId: meta.id, alt: 'media' },
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
    await this.getClient().files.delete({ fileId: meta.id })
  }

  /** Resolves our storage key → the Drive file via the `appProperties.key` tag. */
  private async resolveByKey(key: string): Promise<drive_v3.Schema$File | null> {
    const res = await this.getClient().files.list({
      q: `appProperties has { key='${key}' } and trashed = false`,
      fields: 'files(id, size, mimeType)',
      spaces: 'drive',
      pageSize: 1,
    })
    return res.data.files?.[0] ?? null
  }
}

/** Last path segment of `{org_id}/{file_id}/{filename}`. */
function filenameFromKey(key: string): string {
  return key.split('/').pop() || key
}
