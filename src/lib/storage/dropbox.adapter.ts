import 'server-only'
import logger from '@/lib/logger'
import type { StorageAdapter } from './adapter'
import { signBlobToken } from './blob-token'
import type { ProxyStorageProvider } from '@/modules/storage/storage-settings.schema'

const UPLOAD_URL_TTL_SECONDS = 5 * 60
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60
const PROXY_PATH = '/api/v1/storage/blob'
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
const API_URL = 'https://api.dropboxapi.com/2'
const CONTENT_URL = 'https://content.dropboxapi.com/2'

export type DropboxStorageConfig = {
  appKey: string
  /** Folder prefix in Dropbox, e.g. `/andiko`. */
  rootPath: string
  /** OAuth refresh flow (long-lived). Requires appSecret. */
  appSecret?: string
  refreshToken?: string
  /** Generated access token from App Console (dev; expires). Used directly when set. */
  accessToken?: string
}

type TokenCache = {
  accessToken: string
  expiresAtMs: number
}

/**
 * Dropbox backend for dev/staging (no Workspace required). Bytes are proxied through
 * `/api/v1/storage/blob`. Each `storage_key` maps to `{rootPath}/{storage_key}`.
 */
export class DropboxStorageAdapter implements StorageAdapter {
  readonly provider = 'dropbox'
  readonly bucket: string
  private readonly config: DropboxStorageConfig
  private tokenCache: TokenCache | null = null

  constructor(config: DropboxStorageConfig) {
    this.config = config
    this.bucket = config.rootPath
  }

  async getUploadUrl(params: { key: string; contentType: string; byteSize: number }) {
    const token = signBlobToken({
      provider: 'dropbox',
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
      provider: 'dropbox',
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
      ? params.body
      : Buffer.from(await new Response(params.body).arrayBuffer())
    const accessToken = await this.getAccessToken()
    const path = dropboxPath(this.config.rootPath, key)

    const res = await fetch(`${CONTENT_URL}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': dropboxApiArgHeader({
          path,
          mode: 'overwrite',
          autorename: false,
          mute: true,
        }),
      },
      body: new Uint8Array(body),
    })

    if (!res.ok) {
      const err = await dropboxApiError(res, { path, operation: 'upload' })
      logger.warn({ path, status: res.status, message: err.message }, 'dropbox upload failed')
      throw err
    }
  }

  async headObject(key: string) {
    const meta = await this.getMetadata(key)
    if (!meta) return null
    return { byteSize: meta.size, contentType: null }
  }

  async getObjectStream(key: string) {
    const path = dropboxPath(this.config.rootPath, key)
    const accessToken = await this.getAccessToken()
    const res = await fetch(`${CONTENT_URL}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': dropboxApiArgHeader({ path }),
      },
    })
    if (res.status === 409) return null
    if (!res.ok) {
      throw await dropboxApiError(res, { path, operation: 'download' })
    }
    if (!res.body) return null

    const metaHeader = res.headers.get('dropbox-api-result')
    let byteSize: number | null = null
    if (metaHeader) {
      try {
        const parsed = JSON.parse(metaHeader) as { size?: number }
        byteSize = parsed.size ?? null
      } catch {
        byteSize = null
      }
    }

    return {
      stream: res.body,
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      byteSize,
    }
  }

  async deleteObject(key: string): Promise<void> {
    const path = dropboxPath(this.config.rootPath, key)
    const accessToken = await this.getAccessToken()
    const res = await fetch(`${API_URL}/files/delete_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    })
    if (res.status === 409) return
    if (!res.ok) {
      throw await dropboxApiError(res, { path, operation: 'delete' })
    }
  }

  private async getMetadata(key: string): Promise<{ size: number } | null> {
    const path = dropboxPath(this.config.rootPath, key)
    const accessToken = await this.getAccessToken()
    const res = await fetch(`${API_URL}/files/get_metadata`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, include_deleted: false }),
    })
    if (res.status === 409) return null
    if (!res.ok) {
      throw await dropboxApiError(res, { path, operation: 'metadata' })
    }
    const data = (await res.json()) as { size?: number }
    return { size: data.size ?? 0 }
  }

  private async getAccessToken(): Promise<string> {
    if (this.config.accessToken) {
      return this.config.accessToken
    }

    if (!this.config.refreshToken || !this.config.appSecret) {
      throw new Error('Dropbox no tiene refresh token ni access token configurado')
    }

    if (this.tokenCache && this.tokenCache.expiresAtMs > Date.now() + 60_000) {
      return this.tokenCache.accessToken
    }

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.appKey,
        client_secret: this.config.appSecret,
      }),
    })

    if (!res.ok) {
      throw await dropboxApiError(res, { operation: 'token_refresh' })
    }

    const data = (await res.json()) as { access_token: string; expires_in?: number }
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAtMs: Date.now() + (data.expires_in ?? 3600) * 1000,
    }
    return data.access_token
  }
}

/** Maps a storage key to a Dropbox path under the configured root folder. */
export function dropboxPath(rootPath: string, key: string): string {
  const trimmed = rootPath.trim()
  const root =
    trimmed === '' || trimmed === '/'
      ? ''
      : (trimmed.startsWith('/') ? trimmed : `/${trimmed}`).replace(/\/+$/, '')
  const segments = key.split('/').filter(Boolean)
  if (segments.length > 0) {
    segments[segments.length - 1] = sanitizeDropboxFilename(segments[segments.length - 1])
  }
  const suffix = segments.join('/')
  if (!root) return `/${suffix}`.replace(/\/+/g, '/')
  return `${root}/${suffix}`.replace(/\/+/g, '/')
}

/** Dropbox paths: avoid spaces in filenames — they break HTTP `Dropbox-API-Arg` headers. */
export function sanitizeDropboxFilename(name: string): string {
  return name.replace(/\s+/g, '_')
}

/** JSON args for content endpoints — HTTP-header safe per Dropbox docs. */
export function dropboxApiArgHeader(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload)
  // Escape non-ASCII and DEL (0x7F) as \\uXXXX — required for Dropbox-API-Arg headers.
  return json.replace(/[\u007f-\uffff]/g, (c) => {
    return `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}

/** Maps known Dropbox API failures to user-facing messages. */
export function mapDropboxError(err: unknown): string | null {
  const message = extractErrorMessage(err)
  if (!message) return null
  if (/invalid_grant|expired|invalid refresh token/i.test(message)) {
    return 'El refresh token de Dropbox expiró o es inválido. Generá uno nuevo (OAuth offline) o usá un access token generado en la consola.'
  }
  if (/invalid_access_token|expired_access_token|unauthorized/i.test(message)) {
    return 'El access token de Dropbox expiró. Generá uno nuevo en App Console → Generate access token y actualizá la configuración.'
  }
  if (/missing_scope|insufficient_scope|required scope|does not have the required scope/i.test(message)) {
    return 'El token no tiene los permisos actuales de la app. En App Console activá files.content.read/write, guardá, y generá un token nuevo (Generate) o reconectá con OAuth — el token viejo no se actualiza solo.'
  }
  if (/app folder|not allowed|disallowed|invalid_path|namespace|path\/not_found/i.test(message)) {
    return 'Ruta inválida. Con «App folder» la API usa paths relativos a /Apps/tu-app — no incluyas /Apps/andiko en la ruta raíz; usá / o una subcarpeta como /storage.'
  }
  return message
}

async function dropboxApiError(
  res: Response,
  context?: { path?: string; operation?: string },
): Promise<Error> {
  const text = await res.text()
  let message = `Dropbox API error (${res.status})`
  try {
    const body = JSON.parse(text) as {
      error_summary?: string
      error?: string | { '.tag'?: string; path?: { '.tag'?: string } }
      error_description?: string
    }
    if (typeof body.error_summary === 'string' && body.error_summary) {
      message = body.error_summary
    } else if (typeof body.error_description === 'string' && body.error_description) {
      message = body.error_description
    } else if (typeof body.error === 'string') {
      message = body.error
    } else if (body.error && typeof body.error === 'object' && body.error['.tag']) {
      const tag = body.error['.tag']
      const nested = body.error.path?.['.tag']
      message = nested ? `${tag}/${nested}` : tag
    }
  } catch {
    if (text.trim()) message = text.trim().slice(0, 500)
  }
  if (context?.path) message = `${message} (path: ${context.path})`
  if (context?.operation) message = `${message} [${context.operation}]`
  return new Error(message)
}

function extractErrorMessage(err: unknown): string | null {
  if (err instanceof Error) return err.message
  if (typeof err !== 'object' || err === null) return null
  const e = err as { message?: string; cause?: { message?: string } }
  return e.cause?.message ?? e.message ?? null
}

export function isProxyProvider(value: string): value is ProxyStorageProvider {
  return value === 'gdrive' || value === 'dropbox'
}
