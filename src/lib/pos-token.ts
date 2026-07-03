import 'server-only'
import { createHash } from 'node:crypto'

/**
 * SHA-256 hex digest of a POS device API token, for at-rest storage. Tokens are bearer
 * credentials (like a password) — never persisted in plaintext, only their hash, looked up
 * by matching hash on each request.
 */
export function hashPosToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
