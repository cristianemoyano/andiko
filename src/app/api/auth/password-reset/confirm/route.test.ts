import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/modules/auth/password-reset.service', () => ({
  resetPassword: vi.fn().mockResolvedValue(undefined),
}))

import { resetPassword } from '@/modules/auth/password-reset.service'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const VALID_TOKEN = 'a'.repeat(43)

beforeEach(() => vi.clearAllMocks())

describe('POST /api/auth/password-reset/confirm', () => {
  it('returns 200 {ok:true} on success', async () => {
    const res = await POST(makeRequest({ token: VALID_TOKEN, password: 'new-password-123' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(resetPassword).toHaveBeenCalledWith(VALID_TOKEN, 'new-password-123')
  })

  it('returns 422 when the password is too short', async () => {
    const res = await POST(makeRequest({ token: VALID_TOKEN, password: 'short' }))
    expect(res.status).toBe(422)
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it.each([
    ['TOKEN_INVALID'],
    ['TOKEN_EXPIRED'],
    ['TOKEN_USED'],
    ['USER_INACTIVE'],
  ])('maps %s to a 400 with a Spanish message', async (code) => {
    ;(resetPassword as Mock).mockRejectedValueOnce(new Error(code))
    const res = await POST(makeRequest({ token: VALID_TOKEN, password: 'new-password-123' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe(code)
    expect(typeof body.error).toBe('string')
  })

  it('rethrows an unrecognized error as a 500', async () => {
    ;(resetPassword as Mock).mockRejectedValueOnce(new Error('SOMETHING_ELSE'))
    await expect(POST(makeRequest({ token: VALID_TOKEN, password: 'new-password-123' }))).rejects.toThrow('SOMETHING_ELSE')
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/auth/password-reset/confirm', {
      method: 'POST',
      body: '{not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
