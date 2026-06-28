import 'server-only'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/config/env'
import type { StorageAdapter } from './adapter'

const UPLOAD_URL_TTL_SECONDS = 5 * 60 // browser has 5 min to start the PUT
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60

/** AWS S3 (and S3-compatible) backend. Bytes never pass through the app — only presigned URLs. */
export class S3StorageAdapter implements StorageAdapter {
  readonly provider = 's3'
  readonly bucket: string
  private readonly client: S3Client

  constructor() {
    if (!env.S3_BUCKET) {
      throw new Error('S3_BUCKET is not configured')
    }
    this.bucket = env.S3_BUCKET
    this.client = new S3Client({
      region: env.S3_REGION ?? 'us-east-1',
      ...(env.S3_ENDPOINT
        ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } // MinIO/R2 need path-style
        : {}),
      ...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    })
  }

  async getUploadUrl(params: { key: string; contentType: string; byteSize: number }) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
      ContentLength: params.byteSize,
    })
    const url = await getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS })
    return {
      url,
      method: 'PUT' as const,
      // The browser must send the same Content-Type that was signed, or S3 rejects the PUT.
      headers: { 'Content-Type': params.contentType },
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    }
  }

  async getDownloadUrl(params: {
    key: string
    downloadFilename?: string
    expiresInSeconds?: number
  }) {
    const expiresIn = params.expiresInSeconds ?? DOWNLOAD_URL_TTL_SECONDS
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ...(params.downloadFilename
        ? { ResponseContentDisposition: contentDisposition(params.downloadFilename) }
        : {}),
    })
    const url = await getSignedUrl(this.client, command, { expiresIn })
    return { url, expiresInSeconds: expiresIn }
  }

  async headObject(key: string) {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return {
        byteSize: res.ContentLength ?? 0,
        contentType: res.ContentType ?? null,
      }
    } catch (err: unknown) {
      if (isNotFound(err)) return null
      throw err
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404
}

/** RFC 5987 Content-Disposition so non-ASCII filenames download intact. */
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
