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

  it('throws when registering the same type twice', () => {
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
})
