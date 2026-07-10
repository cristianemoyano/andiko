import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { verifyCapToken } from '@/lib/cap-verify'

describe('verifyCapToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns true when Cap is not configured', async () => {
    vi.stubEnv('CAP_SECRET_KEY', '')
    await expect(verifyCapToken('any')).resolves.toBe(true)
  })

  it('returns true when Cap placeholder secret is set (verification disabled)', async () => {
    vi.stubEnv('CAP_SECRET_KEY', 'cap-secret-not-configured')
    await expect(verifyCapToken('any')).resolves.toBe(true)
  })

  it('returns false for empty token when Cap is configured', async () => {
    vi.stubEnv('CAP_SECRET_KEY', 'test-secret')
    await expect(verifyCapToken('')).resolves.toBe(false)
  })

  it('returns true when siteverify succeeds', async () => {
    vi.stubEnv('CAP_SECRET_KEY', 'test-secret')
    vi.stubEnv('CAP_VERIFY_URL', 'https://cap.example.com/siteverify')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    )

    await expect(verifyCapToken('valid-token')).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      'https://cap.example.com/siteverify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ secret: 'test-secret', response: 'valid-token' }),
      }),
    )
  })

  it('returns false when siteverify fails', async () => {
    vi.stubEnv('CAP_SECRET_KEY', 'test-secret')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      }),
    )

    await expect(verifyCapToken('bad-token')).resolves.toBe(false)
  })

  it('returns false on network error', async () => {
    vi.stubEnv('CAP_SECRET_KEY', 'test-secret')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    await expect(verifyCapToken('token')).resolves.toBe(false)
  })
})
