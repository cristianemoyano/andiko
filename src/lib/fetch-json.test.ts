import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchJson', () => {
  it('returns parsed JSON on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [], total: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const out = await fetchJson<{ data: unknown[]; total: number }>('/api/v1/test')
    expect(out).toEqual({ data: [], total: 0 })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({ credentials: 'same-origin' }),
    )
  })

  it('throws ApiRequestError with API body on 422', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid input', code: 'VALIDATION_ERROR' }), {
          status: 422,
        }),
      ),
    )

    try {
      await fetchJson('/api/v1/test')
      expect.fail('expected throw')
    } catch (e) {
      expect(isApiRequestError(e)).toBe(true)
      if (isApiRequestError(e)) {
        expect(e.status).toBe(422)
        expect(e.code).toBe('VALIDATION_ERROR')
        expect(e.message).toBe('Invalid input')
      }
    }
  })

  it('getApiErrorMessage formats ApiRequestError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'No', code: 'Nope' }), { status: 409 })),
    )
    try {
      await fetchJson('/x')
    } catch (e) {
      expect(getApiErrorMessage(e)).toContain('No')
      expect(getApiErrorMessage(e)).toContain('Nope')
    }
  })
})
