import { describe, expect, it } from 'vitest'

import { vi } from 'vitest'
vi.mock('./sales-quote.model', () => ({
  QUOTE_STATUSES: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
}))
vi.mock('./sales-order.model', () => ({
  ORDER_STATUSES: ['draft', 'confirmed', 'in_progress', 'delivered', 'cancelled'],
}))
vi.mock('./invoice.model', () => ({
  INVOICE_STATUSES: ['draft', 'issued', 'partially_paid', 'paid', 'cancelled'],
}))

import { salesQuoteSchema } from './sales-quote.schema'
import { salesOrderSchema } from './sales-order.schema'
import { invoiceSchema } from './invoice.schema'

const baseItem = {
  description: 'Producto test',
  quantity: 1,
  unit_price: 100,
  discount_pct: 0,
  iva_rate: '21' as const,
  sort_order: 0,
}

describe('sales schemas contact requirement', () => {
  it('requires contact_id on quote create', () => {
    const parsed = salesQuoteSchema.safeParse({
      branch_id: 'f5359181-7b9d-4f0d-b20f-f17e278f4f1a',
      items: [baseItem],
    })
    expect(parsed.success).toBe(false)
  })

  it('requires contact_id on order create', () => {
    const parsed = salesOrderSchema.safeParse({
      branch_id: 'f5359181-7b9d-4f0d-b20f-f17e278f4f1a',
      items: [baseItem],
    })
    expect(parsed.success).toBe(false)
  })

  it('requires contact_id on invoice create', () => {
    const parsed = invoiceSchema.safeParse({
      branch_id: 'f5359181-7b9d-4f0d-b20f-f17e278f4f1a',
      order_id: 'dca2056e-1e30-4932-b3ea-08cdf4d6214a',
      items: [baseItem],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('sales order snapshot fields', () => {
  it('accepts shipping and billing snapshot payload', () => {
    const parsed = salesOrderSchema.safeParse({
      contact_id: '4a91f463-89d9-4315-ad56-58a778806ec2',
      branch_id: 'f5359181-7b9d-4f0d-b20f-f17e278f4f1a',
      promised_date: '2026-04-24T00:00:00.000Z',
      shipping_street: 'Av. Siempre Viva',
      shipping_city: 'Mendoza',
      shipping_province: 'Mendoza',
      shipping_country: 'Argentina',
      billing_street: 'Calle Falsa',
      billing_city: 'Mendoza',
      billing_province: 'Mendoza',
      billing_country: 'Argentina',
      items: [baseItem],
    })
    expect(parsed.success).toBe(true)
  })
})
