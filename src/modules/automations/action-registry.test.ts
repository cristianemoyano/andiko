import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { getAutomationAction, listAutomationActions, registerAutomationAction } from './action-registry'

describe('action-registry', () => {
  it('registers and retrieves an action', () => {
    registerAutomationAction({
      type: 'test.noop',
      label: 'No-op',
      payloadSchema: z.object({}),
      run: vi.fn(async () => ({})),
    })

    const found = getAutomationAction('test.noop')
    expect(found?.label).toBe('No-op')
    expect(listAutomationActions().some(a => a.type === 'test.noop')).toBe(true)
  })

  it('returns undefined for an unregistered type', () => {
    expect(getAutomationAction('nope.nonexistent')).toBeUndefined()
  })

  it('throws when registering the same type twice outside dev', () => {
    registerAutomationAction({
      type: 'test.duplicate',
      label: 'Dup',
      payloadSchema: z.object({}),
      run: vi.fn(async () => ({})),
    })
    expect(() =>
      registerAutomationAction({
        type: 'test.duplicate',
        label: 'Dup 2',
        payloadSchema: z.object({}),
        run: vi.fn(async () => ({})),
      }),
    ).toThrow()
  })

  it('re-registering the same type in dev overwrites instead of throwing (Fast Refresh)', () => {
    vi.stubEnv('NODE_ENV', 'development')
    try {
      registerAutomationAction({
        type: 'test.dev-reload',
        label: 'V1',
        payloadSchema: z.object({}),
        run: vi.fn(async () => ({})),
      })
      expect(() =>
        registerAutomationAction({
          type: 'test.dev-reload',
          label: 'V2',
          payloadSchema: z.object({}),
          run: vi.fn(async () => ({})),
        }),
      ).not.toThrow()
      expect(getAutomationAction('test.dev-reload')?.label).toBe('V2')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
