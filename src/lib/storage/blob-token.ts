import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/config/env'

/**
 * Short-lived signed tokens for the storage proxy (`/api/v1/storage/blob`).
 *
 * Proxy backends (Google Drive) can't issue S3-style presigned URLs, so the adapter mints a URL
 * to our own proxy route signed with one of these tokens. The ReBAC decision already happened in
 * `storage.service` before the URL was handed out, so the proxy trusts a valid, unexpired token
 * exactly like S3 trusts its presigned signature — no second session/permission check needed.
 *
 * Format: `<base64url(payload)>.<base64url(hmac)>`, HMAC-SHA256 keyed by `AUTH_SECRET`
 * (same source `src/lib/crypto.ts` uses — no extra env var).
 */

export type BlobTokenMode = 'put' | 'get'

export interface BlobTokenPayload {
  key: string
  mode: BlobTokenMode
  /** Unix epoch seconds after which the token is invalid. */
  exp: number
  contentType?: string
  filename?: string
}

function sign(data: string): Buffer {
  return createHmac('sha256', env.AUTH_SECRET).update(data).digest()
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

export function signBlobToken(payload: BlobTokenPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64url(sign(body))
  return `${body}.${sig}`
}

/** Returns the payload when the token is authentic and unexpired, else null. */
export function verifyBlobToken(token: string): BlobTokenPayload | null {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const expected = b64url(sign(body))
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let payload: BlobTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as BlobTokenPayload
  } catch {
    return null
  }

  if (typeof payload.key !== 'string' || (payload.mode !== 'put' && payload.mode !== 'get')) {
    return null
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
  return payload
}
