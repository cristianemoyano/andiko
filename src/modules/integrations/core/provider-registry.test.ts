import { describe, it, expect, afterEach, vi } from 'vitest'
import { registerProvider, getProvider, listProviders } from './provider-registry'
import type { ECommerceAdapter } from './ecommerce-adapter'

function stubAdapter(provider: string): ECommerceAdapter {
  return {
    provider,
    testConnection: async () => ({ ok: true }),
    registerWebhooks: async () => {},
    enqueueProductSync: async () => {},
    publishProduct: async () => {},
    enqueueStockSync: async () => {},
    pushStock: async () => {},
    fetchOrder: async () => null,
    importOrder: async () => ({ connectionId: '', externalOrderId: '', salesOrderId: null, syncStatus: 'synced' }),
    importCustomers: async () => ({ contacts_created: 0, contacts_linked: 0, already_linked: 0, synced: 0, skipped: 0 }),
    pushCustomers: async () => ({ created: 0, updated: 0, skipped: 0 }),
    handleWebhook: async () => {},
    runSyncTick: async () => ({ poll: { connections: 0, queued: 0 }, drain: { processed: 0, failed: 0 } }),
  }
}

afterEach(() => vi.unstubAllEnvs())

describe('provider-registry', () => {
  it('registers and resolves a provider by key', () => {
    const adapter = stubAdapter('acme')
    registerProvider(adapter)
    expect(getProvider('acme')).toBe(adapter)
    expect(listProviders()).toContain(adapter)
  })

  it('returns undefined for an unknown provider', () => {
    expect(getProvider('nope')).toBeUndefined()
  })

  it('throws on duplicate registration outside development', () => {
    vi.stubEnv('NODE_ENV', 'production')
    registerProvider(stubAdapter('dup-prod'))
    expect(() => registerProvider(stubAdapter('dup-prod'))).toThrow(/already registered/)
  })

  it('tolerates duplicate registration in development (Fast Refresh)', () => {
    vi.stubEnv('NODE_ENV', 'development')
    registerProvider(stubAdapter('dup-dev'))
    expect(() => registerProvider(stubAdapter('dup-dev'))).not.toThrow()
  })
})
