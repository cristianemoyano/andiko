import { describe, expect, it, beforeAll } from 'vitest'

// env.ts validates process.env at import time; provide the minimum it requires
// before the (dynamic) import of the module under test.
process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db'
process.env.AUTH_SECRET ??= 'test-secret-at-least-32-characters-long'

let mod: typeof import('./crypto')

beforeAll(async () => {
  mod = await import('./crypto')
})

describe('crypto secret encryption', () => {
  it('round-trips a plaintext through encrypt/decrypt', () => {
    const secret = 'super-secret-smtp-password!'
    const token = mod.encryptSecret(secret)
    expect(mod.decryptSecret(token)).toBe(secret)
  })

  it('produces different ciphertext for the same input (random IV)', () => {
    const a = mod.encryptSecret('same')
    const b = mod.encryptSecret('same')
    expect(a).not.toBe(b)
    expect(mod.decryptSecret(a)).toBe('same')
    expect(mod.decryptSecret(b)).toBe('same')
  })

  it('round-trips unicode and empty strings', () => {
    expect(mod.decryptSecret(mod.encryptSecret(''))).toBe('')
    expect(mod.decryptSecret(mod.encryptSecret('contraseña-ñandú-€'))).toBe('contraseña-ñandú-€')
  })

  it('returns null for a tampered or malformed token', () => {
    const token = mod.encryptSecret('x')
    const parts = token.split(':')
    // flip the ciphertext segment
    const tampered = [parts[0], parts[1], parts[2], Buffer.from('garbage').toString('base64')].join(':')
    expect(mod.decryptSecret(tampered)).toBeNull()
    expect(mod.decryptSecret('not-a-token')).toBeNull()
    expect(mod.decryptSecret('v1:only:three')).toBeNull()
  })

  it('isEncryptedSecret recognises tokens but not plaintext', () => {
    expect(mod.isEncryptedSecret(mod.encryptSecret('x'))).toBe(true)
    expect(mod.isEncryptedSecret('plain-password')).toBe(false)
  })
})
