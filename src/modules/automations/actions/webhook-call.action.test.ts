import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../ssrf-guard', () => ({ assertPublicHttpTarget: vi.fn() }))

import { assertPublicHttpTarget } from '../ssrf-guard'
import { getAutomationAction } from '../action-registry'
import './webhook-call.action'

const ctx = { orgId: 'org-1', branchId: null, taskId: 'task-1', runId: 'run-1', signal: new AbortController().signal }
const assertPublicHttpTargetMock = assertPublicHttpTarget as unknown as ReturnType<typeof vi.fn>

describe('core.webhook_call action', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
    assertPublicHttpTargetMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('is registered', () => {
    expect(getAutomationAction('core.webhook_call')).toBeDefined()
  })

  it('calls fetch and returns the response status', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    })
    const action = getAutomationAction('core.webhook_call')!

    const result = await action.run(ctx, { url: 'https://example.com/hook', method: 'POST' })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.data).toEqual({ status: 200, body: '{"ok":true}' })
  })

  it('throws when the response is not ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    })
    const action = getAutomationAction('core.webhook_call')!

    await expect(action.run(ctx, { url: 'https://example.com/hook', method: 'POST' })).rejects.toThrow('500')
  })

  it('checks the SSRF guard before calling fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200, text: async () => '' })
    const action = getAutomationAction('core.webhook_call')!

    await action.run(ctx, { url: 'https://example.com/hook', method: 'POST' })

    expect(assertPublicHttpTargetMock).toHaveBeenCalledWith('https://example.com/hook')
  })

  it('rejects and never calls fetch when the SSRF guard rejects the target', async () => {
    assertPublicHttpTargetMock.mockRejectedValue(new Error('No se permite un destino de red privada o local'))
    const action = getAutomationAction('core.webhook_call')!

    await expect(
      action.run(ctx, { url: 'http://169.254.169.254/meta', method: 'GET' }),
    ).rejects.toThrow('red privada o local')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
