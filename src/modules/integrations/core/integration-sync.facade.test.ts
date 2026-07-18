import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mock } from 'vitest'

// The facade imports the providers barrel purely for its registration side effect;
// stub it so this unit test doesn't pull in every concrete adapter.
vi.mock('../providers', () => ({}))
vi.mock('./provider-registry', () => ({ listProviders: vi.fn(), getProvider: vi.fn() }))

import {
  enqueueOutboundStockSync,
  enqueueOutboundProductSync,
  runIntegrationsSyncTick,
  dispatchWebhook,
  UnknownProviderError,
} from './integration-sync.facade'
import { listProviders, getProvider } from './provider-registry'

function fakeAdapter(provider: string) {
  return {
    provider,
    enqueueStockSync: vi.fn().mockResolvedValue(undefined),
    enqueueProductSync: vi.fn().mockResolvedValue(undefined),
    handleWebhook: vi.fn().mockResolvedValue(undefined),
    runSyncTick: vi.fn().mockResolvedValue({ poll: { connections: 1, queued: 2 }, drain: { processed: 3, failed: 0 } }),
  }
}

const tx = {} as never

beforeEach(() => vi.clearAllMocks())

describe('integration-sync.facade', () => {
  it('fans stock sync out to every registered provider', async () => {
    const a = fakeAdapter('a')
    const b = fakeAdapter('b')
    ;(listProviders as Mock).mockReturnValue([a, b])

    await enqueueOutboundStockSync('v1', 'w1', 'org1', tx)

    expect(a.enqueueStockSync).toHaveBeenCalledWith('v1', 'w1', 'org1', tx)
    expect(b.enqueueStockSync).toHaveBeenCalledWith('v1', 'w1', 'org1', tx)
  })

  it('fans product sync out to every registered provider', async () => {
    const a = fakeAdapter('a')
    ;(listProviders as Mock).mockReturnValue([a])

    await enqueueOutboundProductSync('org1', ['v1', 'v2'], tx)

    expect(a.enqueueProductSync).toHaveBeenCalledWith('org1', ['v1', 'v2'], tx)
  })

  it('collects a per-provider sync tick result', async () => {
    ;(listProviders as Mock).mockReturnValue([fakeAdapter('a'), fakeAdapter('b')])

    const results = await runIntegrationsSyncTick()

    expect(results).toEqual([
      { provider: 'a', poll: { connections: 1, queued: 2 }, drain: { processed: 3, failed: 0 } },
      { provider: 'b', poll: { connections: 1, queued: 2 }, drain: { processed: 3, failed: 0 } },
    ])
  })

  it('routes a webhook to the named provider', async () => {
    const a = fakeAdapter('woocommerce')
    ;(getProvider as Mock).mockReturnValue(a)

    await dispatchWebhook('woocommerce', 'conn1', 'body', { signature: 'sig', topic: 'order.created' })

    expect(a.handleWebhook).toHaveBeenCalledWith('conn1', 'body', { signature: 'sig', topic: 'order.created' })
  })

  it('throws UnknownProviderError for an unregistered provider', () => {
    ;(getProvider as Mock).mockReturnValue(undefined)
    expect(() => dispatchWebhook('shopify', 'c', 'b', { signature: null, topic: null })).toThrow(UnknownProviderError)
  })
})
