import 'server-only'
import type { Transaction } from 'sequelize'
// Side-effect import: registers every built-in provider (WooCommerce, …) before
// the registry is queried. Keep this first.
import '../providers'
import { getProvider, listProviders } from './provider-registry'
import type { SyncTickResult } from './ecommerce-adapter'
import type { WebhookHeaders } from './ecommerce-adapter'

/**
 * The provider-agnostic entry points the ERP business logic calls. Each fans out
 * over every registered provider, so callers never know which integrations exist.
 * These are the formalized replacements for the old direct `woo-*` imports.
 */

/** Enqueue a stock push to every provider (transactional outbox). Called from inventory. */
export async function enqueueOutboundStockSync(
  variantId: string,
  warehouseId: string,
  orgId: string,
  t: Transaction,
): Promise<void> {
  for (const adapter of listProviders()) {
    await adapter.enqueueStockSync(variantId, warehouseId, orgId, t)
  }
}

/** Enqueue a catalog publish to every provider (transactional outbox). Called from catalog. */
export async function enqueueOutboundProductSync(
  orgId: string,
  variantIds: string[],
  t?: Transaction,
): Promise<void> {
  for (const adapter of listProviders()) {
    await adapter.enqueueProductSync(orgId, variantIds, t)
  }
}

export interface ProviderSyncTickResult extends SyncTickResult {
  provider: string
}

/** Run one sync tick for every provider. Called from the cron route. */
export async function runIntegrationsSyncTick(): Promise<ProviderSyncTickResult[]> {
  const results: ProviderSyncTickResult[] = []
  for (const adapter of listProviders()) {
    const tick = await adapter.runSyncTick()
    results.push({ provider: adapter.provider, ...tick })
  }
  return results
}

export class UnknownProviderError extends Error {
  readonly code = 'UNKNOWN_PROVIDER' as const
  constructor(provider: string) {
    super(`Unknown integration provider: ${provider}`)
    this.name = 'UnknownProviderError'
  }
}

/** Route a webhook delivery to the named provider's adapter. Called from the webhook route. */
export function dispatchWebhook(
  provider: string,
  connectionId: string,
  rawBody: string,
  headers: WebhookHeaders,
): Promise<void> {
  const adapter = getProvider(provider)
  if (!adapter) throw new UnknownProviderError(provider)
  return adapter.handleWebhook(connectionId, rawBody, headers)
}
