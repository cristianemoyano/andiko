/** DB-only product units processed per UI tick (cancel checked between each job). */
export const WOO_IMPORT_PRODUCTS_TICK_BATCH = 20

/** Woo API + ERP ingest per order — smaller batch to stay responsive. */
export const WOO_IMPORT_ORDERS_TICK_BATCH = 5

/** Woo API fetch per customer. */
export const WOO_IMPORT_CUSTOMERS_TICK_BATCH = 10

/** Parallel Woo REST calls when expanding variable products at import start. */
export const WOO_VARIATION_FETCH_CONCURRENCY = 8

export const WOO_IMPORT_TICK_BATCH = {
  products: WOO_IMPORT_PRODUCTS_TICK_BATCH,
  orders: WOO_IMPORT_ORDERS_TICK_BATCH,
  customers: WOO_IMPORT_CUSTOMERS_TICK_BATCH,
} as const

export type WooImportTickScope = keyof typeof WOO_IMPORT_TICK_BATCH

export function defaultImportTickBatch(scope?: WooImportTickScope | null): number {
  if (scope && scope in WOO_IMPORT_TICK_BATCH) {
    return WOO_IMPORT_TICK_BATCH[scope]
  }
  return WOO_IMPORT_PRODUCTS_TICK_BATCH
}
