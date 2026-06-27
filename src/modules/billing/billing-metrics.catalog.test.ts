import { describe, it, expect } from 'vitest'
import {
  TRACKED_BILLING_METRICS,
  buildTrackedMetricsCatalog,
  getTrackedBillingMetric,
  isTrackedBillingMetricKey,
} from './billing-metrics.catalog'

describe('billing-metrics.catalog', () => {
  it('exposes unique metric keys', () => {
    const keys = TRACKED_BILLING_METRICS.map(m => m.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('recognizes known keys', () => {
    expect(isTrackedBillingMetricKey('afip_invoices_issued')).toBe(true)
    expect(isTrackedBillingMetricKey('custom_metric')).toBe(false)
  })

  it('returns definition by key', () => {
    const def = getTrackedBillingMetric('pos_tickets')
    expect(def?.label).toBe('Tickets POS')
    expect(def?.default_unit_price).toBe('5.00')
  })

  it('builds catalog status from configured keys', () => {
    const status = buildTrackedMetricsCatalog(new Set(['afip_invoices_issued']))
    expect(status).toHaveLength(3)
    expect(status.find(s => s.key === 'afip_invoices_issued')?.configured).toBe(true)
    expect(status.find(s => s.key === 'pos_tickets')?.configured).toBe(false)
  })
})
