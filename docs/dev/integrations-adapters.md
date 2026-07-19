# Integrations — Adapter / Plugin Architecture

The Integrations module is **platform-agnostic**. The ERP core (inventory, catalog,
sales, cron, webhooks) never talks to a storefront/marketplace API directly — it
talks only to the `ECommerceAdapter` abstraction. Each platform (WooCommerce today;
Mercado Libre, Tiendanube, Shopify, PrestaShop, Magento, … tomorrow) ships one
concrete adapter and registers it. Adding a provider requires **no change to ERP
business logic** (Open/Closed Principle).

## Layout

```
src/modules/integrations/
  index.ts                         ← public API (import from here)
  core/
    ecommerce-adapter.ts           ← ECommerceAdapter interface + normalized domain model
    provider-registry.ts           ← register/get/list providers (Map-based)
    integration-sync.facade.ts     ← provider-agnostic entry points the ERP calls
  providers/
    index.ts                       ← side-effect barrel: registers every adapter
  woocommerce/                     ← the first concrete provider
    woocommerce.adapter.ts         ← implements ECommerceAdapter (delegates to woo services)
    woo-*.service.ts, *.model.ts   ← WooCommerce-specific implementation & persistence
```

## The abstraction

`ECommerceAdapter` (`core/ecommerce-adapter.ts`) captures every operation the ERP
needs, in neutral terms:

| Area | Methods |
|---|---|
| Connection & auth | `testConnection`, `registerWebhooks` |
| Product sync (ERP→platform) | `enqueueProductSync`, `publishProduct` |
| Inventory (ERP→platform) | `enqueueStockSync`, `pushStock` |
| Orders (platform→ERP) | `fetchOrder`, `importOrder` |
| Customers (bidirectional) | `importCustomers`, `pushCustomers` |
| Webhooks / events | `handleWebhook` |
| Reconciliation | `runSyncTick` |

Platform payloads are mapped onto the **normalized domain model**
(`NormalizedOrder`, `NormalizedCustomer`, `NormalizedProduct`, `NormalizedAddress`,
`NormalizedLineItem`) at the adapter boundary, so nothing above the adapter ever
sees a platform-specific field name.

The ERP calls the **facade** (`integration-sync.facade.ts`), which fans out over
every registered provider:

- `enqueueOutboundStockSync(...)` — from `inventory/stock-movements.service.ts`
- `enqueueOutboundProductSync(...)` — from `catalog/product-variants.service.ts`
- `runIntegrationsSyncTick()` — from the cron route `api/v1/integrations/woocommerce/sync`
- `dispatchWebhook(provider, connectionId, rawBody, headers)` — from the webhook route

## Adding a new provider (3 steps)

Say you're adding **Mercado Libre**:

1. **Implement the adapter.** Create `src/modules/integrations/mercadolibre/mercadolibre.adapter.ts`
   exporting `const mercadoLibreAdapter: ECommerceAdapter = { provider: 'mercadolibre', … }`.
   Implement each method — your own OAuth2 client, product/stock push, order fetch +
   normalization, customer sync, webhook signature verification. **Reuse the shared
   infrastructure**: the transactional outbox (sync queue) pattern, the encrypted
   credential storage (`src/lib/crypto.ts`, `*_encrypted TEXT`, never returned raw),
   and the ERP domain services (`ingestOrder`-style contact/stock logic) — you only
   supply the platform I/O and the normalization.

2. **Register it.** Add one line to `src/modules/integrations/providers/index.ts`:
   ```ts
   import { mercadoLibreAdapter } from '../mercadolibre/mercadolibre.adapter'
   registerProvider(mercadoLibreAdapter)
   ```

3. **Configure credentials.** Store the connection + encrypted credentials in the
   provider's own config table (mirror `woocommerce_sites` / `toPublicSite`).

That's it — inventory, catalog, sales, and the cron/webhook plumbing pick the new
provider up automatically via the registry. No business-logic change.

### What a new provider implements vs. gets for free

| Capability | New adapter provides | Shared infra reused |
|---|---|---|
| Auth / connection | Platform auth scheme + `testConnection` | `lib/crypto`, `toPublicSite` projection |
| Product sync | Map ERP variant → platform payload; create/update API | Outbox + worker, product-link table, content-hash no-op skip |
| Inventory | Platform "set stock" call | `computeAvailableForSite`, enqueue-on-movement seam |
| Order import | Fetch order + normalize | ERP `ingestOrder` (contact/number/IVA/stock/idempotency) |
| Customer sync | Normalize customer ↔ contact | Contact upsert/link/address services, customer-link table |
| Webhooks | Verify signature + parse envelope | Webhook route shape, outbox, async worker |

## Roadmap (future layers)

This is **Layer 1**: the business-logic seam. Two follow-ups are intentionally
deferred:

- **Layer 2 — persistence generalization:** rename `woocommerce_*` tables to
  `integration_*` with a `provider` discriminator column (+ data migration), so all
  providers share one connection/link/queue schema instead of per-provider tables.
- **Layer 3 — channel-concept neutralization:** replace `source='woocommerce'`,
  `woo-list-filters`, `woo-order-status.utils`, and `import_source` across
  sales/contacts/catalog with a generic "sales channel" concept.
