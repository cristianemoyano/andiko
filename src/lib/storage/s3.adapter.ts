import 'server-only'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageAdapter } from './adapter'

const UPLOAD_URL_TTL_SECONDS = 5 * 60
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60

export type S3StorageConfig = {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
}

/** AWS S3 (and S3-compatible) backend. Bytes never pass through the app — only presigned URLs. */
export class S3StorageAdapter implements StorageAdapter {
  readonly provider = 's3'
  readonly bucket: string
  private readonly client: S3Client

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Presigned browser PUTs and server-side fetch to presigned URLs fail with 403 when
      // the SDK signs checksum headers the client does not send (SDK >= 3.729 default).
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
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

  async putObject(key: string, params: { contentType: string; body: ReadableStream | Buffer }) {
    const body = Buffer.isBuffer(params.body)
      ? params.body
      : Buffer.from(await new Response(params.body).arrayBuffer())
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: params.contentType,
        Body: body,
      }),
    )
  }

  async getObjectStream(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    if (!res.Body) return null
    const body = res.Body
    const stream =
      body instanceof ReadableStream
        ? body
        : (Readable.toWeb(body as import('node:stream').Readable) as ReadableStream)
    return {
      stream,
      contentType: res.ContentType ?? null,
      byteSize: res.ContentLength ?? null,
    }
  }
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
