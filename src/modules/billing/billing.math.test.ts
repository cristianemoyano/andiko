import { describe, it, expect } from 'vitest'
import { calcSubscriptionCharges, calcBillingTotals } from './billing.math'

const basePlan = {
  name: 'Pro',
  base_price: '10000.00',
  included_seats: 3,
  per_seat_price: '1500.00',
}

describe('calcSubscriptionCharges', () => {
  it('emits only the base line when seats are within plan and no addons/usage', () => {
    const lines = calcSubscriptionCharges({ plan: basePlan, seats: 2, addons: [], usage: [] })
    expect(lines).toHaveLength(1)
    expect(lines[0].kind).toBe('base')
    expect(lines[0].subtotal).toBe('10000.00')
    expect(lines[0].tax_amount).toBe('2100.00') // 21%
    expect(lines[0].total).toBe('12100.00')
  })

  it('adds a seat-overage line for seats beyond included_seats', () => {
    const lines = calcSubscriptionCharges({ plan: basePlan, seats: 5, addons: [], usage: [] })
    const seat = lines.find(l => l.kind === 'seat')
    expect(seat).toBeDefined()
    expect(seat!.quantity).toBe('2.0000')        // 5 - 3
    expect(seat!.subtotal).toBe('3000.00')        // 2 * 1500
    expect(seat!.total).toBe('3630.00')           // +21%
  })

  it('includes only enabled, non-zero module add-ons', () => {
    const lines = calcSubscriptionCharges({
      plan: basePlan,
      seats: 1,
      addons: [
        { module_key: 'inventory', unit_price: '2000.00', enabled: true },
        { module_key: 'accounting', unit_price: '3000.00', enabled: false },
        { module_key: 'pos', unit_price: '0.00', enabled: true },
      ],
      usage: [],
    })
    const addonLines = lines.filter(l => l.kind === 'module_addon')
    expect(addonLines).toHaveLength(1)
    expect(addonLines[0].description).toContain('inventory')
    expect(addonLines[0].subtotal).toBe('2000.00')
  })

  it('adds metered usage lines priced by metric unit_price', () => {
    const lines = calcSubscriptionCharges({
      plan: basePlan,
      seats: 1,
      addons: [],
      usage: [
        { metric_key: 'invoices_issued', label: 'Facturas emitidas', unit_label: 'doc', unit_price: '10.00', quantity: '150.0000' },
        { metric_key: 'storage_gb', label: 'Almacenamiento', unit_label: 'GB', unit_price: '50.00', quantity: '0.0000' },
      ],
    })
    const usageLines = lines.filter(l => l.kind === 'usage')
    expect(usageLines).toHaveLength(1) // zero-quantity skipped
    expect(usageLines[0].subtotal).toBe('1500.00') // 150 * 10
  })
})

describe('calcBillingTotals', () => {
  it('sums subtotal, tax and total across all lines', () => {
    const lines = calcSubscriptionCharges({
      plan: basePlan,
      seats: 5,
      addons: [{ module_key: 'inventory', unit_price: '2000.00', enabled: true }],
      usage: [{ metric_key: 'invoices_issued', label: 'Facturas', unit_label: null, unit_price: '10.00', quantity: '100.0000' }],
    })
    const totals = calcBillingTotals(lines)
    // base 10000 + seats 3000 + addon 2000 + usage 1000 = 16000 subtotal
    expect(totals.subtotal).toBe('16000.00')
    expect(totals.tax_amount).toBe('3360.00')  // 21%
    expect(totals.total).toBe('19360.00')
  })
})
