import 'server-only'

// Side-effect-only barrel: importing this file registers every built-in
// e-commerce integration provider. A new provider is added by creating its
// adapter and registering it here — the integrations core (provider-registry.ts,
// integration-sync.facade.ts) and all ERP business logic never change.
import { registerProvider } from '../core/provider-registry'
import { wooCommerceAdapter } from '../woocommerce/woocommerce.adapter'

registerProvider(wooCommerceAdapter)
