import { describe, it, expect } from 'vitest'
import { calcSubscriptionCharges, calcBillingTotals } from './billing.math'

const basePlan = {
  name: 'Pro',
  base_price: '10000.00',
  included_seats: 3,
  per_seat_price: '1500.00',
  included_branches: 1,
  per_branch_price: '2500.00',
  included_sites: 0,
  per_site_price: '4000.00',
}

const baseInput = {
  plan: basePlan,
  seats: 1,
  contracted_seats: 0,
  branches: 1,
  sites: 0,
  addons: [] as { module_key: string; unit_price: string; enabled: boolean }[],
  extras: [] as { extra_key: string; unit_price: string; enabled: boolean }[],
  usage: [] as { metric_key: string; label: string; unit_label: string | null; unit_price: string; quantity: string; included_quantity: string }[],
}

describe('calcSubscriptionCharges', () => {
  it('includes base and capacity summary lines when within plan limits', () => {
    const lines = calcSubscriptionCharges({ ...baseInput, seats: 2 })
    expect(lines.find(l => l.kind === 'base')).toBeDefined()
    expect(lines.filter(l => l.kind === 'adjustment')).toHaveLength(3)
    expect(lines.find(l => l.kind === 'seat')).toBeUndefined()
    expect(lines.find(l => l.kind === 'site')).toBeUndefined()
    expect(calcBillingTotals(lines).subtotal).toBe('10000.00')
  })

  it('adds a site-overage line for WooCommerce sites beyond included_sites', () => {
    const lines = calcSubscriptionCharges({ ...baseInput, sites: 2 })
    const site = lines.find(l => l.kind === 'site')
    expect(site).toBeDefined()
    expect(site!.quantity).toBe('2.0000')        // 2 - 0 included
    expect(site!.subtotal).toBe('8000.00')       // 2 * 4000
    expect(site!.total).toBe('9680.00')          // +21%
    expect(site!.description).toContain('2 activos')
  })

  it('adds a seat-overage line for seats beyond included_seats', () => {
    const lines = calcSubscriptionCharges({ ...baseInput, seats: 5 })
    const seat = lines.find(l => l.kind === 'seat')
    expect(seat).toBeDefined()
    expect(seat!.quantity).toBe('2.0000')        // 5 - 3
    expect(seat!.subtotal).toBe('3000.00')        // 2 * 1500
    expect(seat!.total).toBe('3630.00')           // +21%
    expect(seat!.description).toContain('5 activos')
  })

  it('uses contracted seats as billing floor when above active users', () => {
    const lines = calcSubscriptionCharges({ ...baseInput, seats: 2, contracted_seats: 5 })
    const seat = lines.find(l => l.kind === 'seat')
    expect(seat).toBeDefined()
    expect(seat!.quantity).toBe('2.0000') // 5 contracted - 3 included
    expect(seat!.description).toContain('por encima de los 3 incluidos')
  })

  it('adds a branch-overage line for branches beyond included_branches', () => {
    const lines = calcSubscriptionCharges({ ...baseInput, branches: 4 })
    const branch = lines.find(l => l.kind === 'branch')
    expect(branch).toBeDefined()
    expect(branch!.quantity).toBe('3.0000')        // 4 - 1
    expect(branch!.subtotal).toBe('7500.00')       // 3 * 2500
    expect(branch!.description).toContain('4 activas')
  })

  it('lists all enabled module add-ons including included ($0) ones', () => {
    const lines = calcSubscriptionCharges({
      ...baseInput,
      addons: [
        { module_key: 'inventory', unit_price: '2000.00', enabled: true },
        { module_key: 'accounting', unit_price: '3000.00', enabled: false },
        { module_key: 'pos', unit_price: '0.00', enabled: true },
      ],
      usage: [],
    })
    const addonLines = lines.filter(l => l.kind === 'module_addon')
    expect(addonLines).toHaveLength(2)
    expect(addonLines.find(l => l.description.includes('Inventario'))?.subtotal).toBe('2000.00')
    expect(addonLines.find(l => l.description.includes('POS'))?.subtotal).toBe('0.00')
  })

  it('lists all enabled service extras including included ($0) ones', () => {
    const lines = calcSubscriptionCharges({
      ...baseInput,
      extras: [
        { extra_key: 'whatsapp_support', unit_price: '5000.00', enabled: true },
        { extra_key: 'backup', unit_price: '3000.00', enabled: false },
        { extra_key: 'training', unit_price: '0.00', enabled: true },
      ],
    })
    const extraLines = lines.filter(l => l.kind === 'extra_addon')
    expect(extraLines).toHaveLength(2)
    expect(extraLines.find(l => l.description.includes('WhatsApp'))?.subtotal).toBe('5000.00')
    expect(extraLines.find(l => l.description.includes('Capacitación'))?.subtotal).toBe('0.00')
  })

  it('adds metered usage lines priced by metric unit_price', () => {
    const lines = calcSubscriptionCharges({
      ...baseInput,
      addons: [],
      usage: [
        { metric_key: 'invoices_issued', label: 'Facturas emitidas', unit_label: 'doc', unit_price: '10.00', quantity: '150.0000', included_quantity: '0.0000' },
        { metric_key: 'storage_gb', label: 'Almacenamiento', unit_label: 'GB', unit_price: '50.00', quantity: '0.0000', included_quantity: '0.0000' },
      ],
    })
    const usageLines = lines.filter(l => l.kind === 'usage')
    expect(usageLines).toHaveLength(1) // zero-quantity skipped
    expect(usageLines[0].description).toContain('Facturas emitidas')
    expect(usageLines[0].subtotal).toBe('1500.00') // 150 * 10
  })

  it('bills only usage beyond plan and subscription allowance', () => {
    const lines = calcSubscriptionCharges({
      ...baseInput,
      usage: [
        {
          metric_key: 'afip_invoices_issued',
          label: 'Comprobantes AFIP',
          unit_label: 'comp.',
          unit_price: '15.00',
          quantity: '320.0000',
          included_quantity: '300.0000',
          plan_included_quantity: '100.0000',
          subscription_extra_included: '200.0000',
        },
      ],
    })
    const usageLines = lines.filter(l => l.kind === 'usage')
    expect(usageLines).toHaveLength(1)
    expect(usageLines[0].quantity).toBe('20.0000')
    expect(usageLines[0].subtotal).toBe('300.00')
    expect(lines.some(l => l.kind === 'adjustment' && l.description.includes('100 plan + 200 contrato'))).toBe(true)
  })

  it('bills only usage beyond plan allowance', () => {
    const lines = calcSubscriptionCharges({
      ...baseInput,
      usage: [
        {
          metric_key: 'afip_invoices_issued',
          label: 'Comprobantes AFIP',
          unit_label: 'comp.',
          unit_price: '15.00',
          quantity: '120.0000',
          included_quantity: '100.0000',
        },
      ],
    })
    const usageLines = lines.filter(l => l.kind === 'usage')
    expect(usageLines).toHaveLength(1)
    expect(usageLines[0].quantity).toBe('20.0000')
    expect(usageLines[0].subtotal).toBe('300.00')
    expect(lines.some(l => l.kind === 'adjustment' && l.description.includes('incluidos en plan'))).toBe(true)
  })

  it('shows $0 usage line when all consumption is within allowance', () => {
    const lines = calcSubscriptionCharges({
      ...baseInput,
      usage: [
        {
          metric_key: 'afip_invoices_issued',
          label: 'Comprobantes AFIP',
          unit_label: 'comp.',
          unit_price: '15.00',
          quantity: '40.0000',
          included_quantity: '100.0000',
        },
      ],
    })
    const usageLines = lines.filter(l => l.kind === 'usage')
    expect(usageLines).toHaveLength(1)
    expect(usageLines[0].subtotal).toBe('0.00')
    expect(usageLines[0].description).toContain('incluidos en plan')
  })
})

describe('calcBillingTotals', () => {
  it('sums only billable lines (ignores $0 informational lines in subtotal)', () => {
    const lines = calcSubscriptionCharges({
      ...baseInput,
      seats: 5,
      addons: [{ module_key: 'inventory', unit_price: '2000.00', enabled: true }],
      usage: [{ metric_key: 'invoices_issued', label: 'Facturas', unit_label: null, unit_price: '10.00', quantity: '100.0000', included_quantity: '0.0000' }],
    })
    const totals = calcBillingTotals(lines)
    // base 10000 + seats 3000 + addon 2000 + usage 1000 = 16000 subtotal (adjustment lines are $0)
    expect(totals.subtotal).toBe('16000.00')
    expect(totals.tax_amount).toBe('3360.00')  // 21%
    expect(totals.total).toBe('19360.00')
  })
})
