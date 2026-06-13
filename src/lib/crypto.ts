import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { env } from '@/config/env'

/**
 * Symmetric encryption for secrets stored at rest (e.g. SMTP passwords in
 * `organization_settings`). Uses AES-256-GCM with a key derived from
 * `AUTH_SECRET` so no extra env var is required. The output is a single
 * self-describing string: `v1:<iv>:<authTag>:<ciphertext>` (all base64).
 *
 * This is NOT a substitute for a dedicated KMS, but ensures credentials are
 * never persisted or returned in plaintext.
 */

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'v1'
const SALT = 'andiko:secret:v1'

let cachedKey: Buffer | null = null
function getKey(): Buffer {
  if (cachedKey) return cachedKey
  cachedKey = scryptSync(env.AUTH_SECRET, SALT, 32)
  return cachedKey
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/** Returns null if the value is not a valid encrypted blob (e.g. tampered or legacy). */
export function decryptSecret(value: string): string | null {
  const parts = value.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) return null
  try {
    const iv = Buffer.from(parts[1], 'base64')
    const authTag = Buffer.from(parts[2], 'base64')
    const ciphertext = Buffer.from(parts[3], 'base64')
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf8')
  } catch {
    return null
  }
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${PREFIX}:`)
}
