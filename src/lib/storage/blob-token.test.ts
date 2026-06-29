import { describe, it, expect, vi } from 'vitest'

vi.mock('@/config/env', () => ({ env: { AUTH_SECRET: 'unit-test-secret-key-1234567890' } }))

import { signBlobToken, verifyBlobToken } from './blob-token'

const future = () => Math.floor(Date.now() / 1000) + 300
const past = () => Math.floor(Date.now() / 1000) - 5

describe('blob-token', () => {
  it('round-trips a valid token', () => {
    const token = signBlobToken({
      key: 'org/file/doc.pdf',
      mode: 'put',
      exp: future(),
      contentType: 'application/pdf',
      byteSize: 1024,
    })
    const payload = verifyBlobToken(token)
    expect(payload).toMatchObject({
      key: 'org/file/doc.pdf',
      mode: 'put',
      contentType: 'application/pdf',
      byteSize: 1024,
    })
  })

  it('preserves the download filename', () => {
    const token = signBlobToken({ key: 'k', mode: 'get', exp: future(), filename: 'reporte.pdf' })
    expect(verifyBlobToken(token)?.filename).toBe('reporte.pdf')
  })

  it('rejects an expired token', () => {
    const token = signBlobToken({ key: 'k', mode: 'get', exp: past() })
    expect(verifyBlobToken(token)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const token = signBlobToken({ key: 'k', mode: 'get', exp: future() })
    const [body, sig] = token.split('.')
    const flipped = `${body}x.${sig}`
    expect(verifyBlobToken(flipped)).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const token = signBlobToken({ key: 'k', mode: 'get', exp: future() })
    const [body] = token.split('.')
    expect(verifyBlobToken(`${body}.deadbeef`)).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(verifyBlobToken('')).toBeNull()
    expect(verifyBlobToken('no-dot')).toBeNull()
  })
})
