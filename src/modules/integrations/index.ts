// Public API of the Integrations module.
//
// ERP business logic must import ONLY from here — never from a provider's internal
// files. This exposes the provider-agnostic abstraction (the `ECommerceAdapter`
// contract, the provider registry, and the sync facade). Concrete providers
// (WooCommerce, and future ones) live behind the registry and are never referenced
// by name outside `providers/`.
//
// See docs/dev/integrations-adapters.md for how to add a new provider.

export * from './core/ecommerce-adapter'
export * from './core/provider-registry'
export * from './core/integration-sync.facade'
