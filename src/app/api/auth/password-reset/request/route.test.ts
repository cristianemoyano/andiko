import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/modules/auth/password-reset.service', () => ({
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
}))

import { requestPasswordReset } from '@/modules/auth/password-reset.service'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/auth/password-reset/request', () => {
  it('always responds 200 {ok:true} for a valid email, regardless of the service outcome', async () => {
    const res = await POST(makeRequest({ email: 'known@test.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(requestPasswordReset).toHaveBeenCalledWith('known@test.com')
  })

  it('returns 200 {ok:true} for an unknown email too — identical response shape', async () => {
    const res = await POST(makeRequest({ email: 'unknown@test.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 422 for an invalid email', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }))
    expect(res.status).toBe(422)
    expect(requestPasswordReset).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/auth/password-reset/request', {
      method: 'POST',
      body: '{not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('propagates an unexpected service error as a 500', async () => {
    ;(requestPasswordReset as Mock).mockRejectedValueOnce(new Error('DB down'))
    await expect(POST(makeRequest({ email: 'known@test.com' }))).rejects.toThrow('DB down')
  })
})
