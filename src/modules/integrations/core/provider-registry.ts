import 'server-only'
import type { ECommerceAdapter } from './ecommerce-adapter'

/**
 * In-memory registry of e-commerce integration providers, keyed by `provider`.
 *
 * Adapters register themselves via the side-effect barrel `integrations/providers`.
 * The ERP resolves providers only through this registry, so a new integration is
 * added without touching any core or business-logic code (Open/Closed).
 *
 * Mirrors `src/modules/automations/action-registry.ts`.
 */
const registry = new Map<string, ECommerceAdapter>()

export function registerProvider(adapter: ECommerceAdapter): void {
  // In dev, Next.js Fast Refresh can re-execute a provider's module (and the
  // barrel) without resetting this in-memory registry, so re-registering the same
  // provider is expected there. Outside dev, a duplicate is a programmer error.
  if (registry.has(adapter.provider) && process.env.NODE_ENV !== 'development') {
    throw new Error(`Integration provider already registered: ${adapter.provider}`)
  }
  registry.set(adapter.provider, adapter)
}

export function getProvider(provider: string): ECommerceAdapter | undefined {
  return registry.get(provider)
}

export function listProviders(): ECommerceAdapter[] {
  return Array.from(registry.values())
}
