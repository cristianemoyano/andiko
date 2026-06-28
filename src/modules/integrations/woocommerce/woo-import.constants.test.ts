import { describe, expect, it } from 'vitest'
import {
  defaultImportTickBatch,
  WOO_IMPORT_CUSTOMERS_TICK_BATCH,
  WOO_IMPORT_ORDERS_TICK_BATCH,
  WOO_IMPORT_PRODUCTS_TICK_BATCH,
} from './woo-import.constants'

describe('defaultImportTickBatch', () => {
  it('returns scope-specific batch sizes', () => {
    expect(defaultImportTickBatch('products')).toBe(WOO_IMPORT_PRODUCTS_TICK_BATCH)
    expect(defaultImportTickBatch('orders')).toBe(WOO_IMPORT_ORDERS_TICK_BATCH)
    expect(defaultImportTickBatch('customers')).toBe(WOO_IMPORT_CUSTOMERS_TICK_BATCH)
  })

  it('falls back to products batch when scope is unknown', () => {
    expect(defaultImportTickBatch(null)).toBe(WOO_IMPORT_PRODUCTS_TICK_BATCH)
  })
})
