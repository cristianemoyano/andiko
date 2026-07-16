import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/config/env', () => ({ env: { AUTH_URL: 'https://erp.test' } }))
vi.mock('@/modules/sales/sales-quotes.service', () => ({ getQuote: vi.fn() }))
vi.mock('@/modules/sales/sales-orders.service', () => ({ getOrder: vi.fn() }))
vi.mock('@/modules/sales/invoices.service', () => ({ getInvoice: vi.fn() }))
vi.mock('@/modules/inventory/delivery-notes.service', () => ({ getDeliveryNote: vi.fn() }))
vi.mock('@/modules/purchases/purchase-orders.service', () => ({ getPurchaseOrder: vi.fn() }))
vi.mock('@/modules/printing/issuer', () => ({ getIssuerName: vi.fn().mockResolvedValue('Mi Empresa') }))
vi.mock('@/modules/contacts/contact-lookup.service', () => ({ resolveContactDisplay: vi.fn() }))

import { getQuote } from '@/modules/sales/sales-quotes.service'
import { getPurchaseOrder } from '@/modules/purchases/purchase-orders.service'
import { resolveContactDisplay } from '@/modules/contacts/contact-lookup.service'
import { resolveDocument } from './document-resolver'

const ctx = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] }

beforeEach(() => vi.clearAllMocks())

describe('resolveDocument', () => {
  it('resolves a purchase_order via getPurchaseOrder, with "Proveedor" as the contact fallback', async () => {
    ;(getPurchaseOrder as Mock).mockResolvedValue({
      order_number: 'OC-0001', total: '500.00', contact_id: null,
    })
    ;(resolveContactDisplay as Mock).mockResolvedValue({ email: null, name: 'Proveedor' })

    const result = await resolveDocument('purchase_order', 'po-1', ctx)

    expect(getPurchaseOrder).toHaveBeenCalledWith('po-1', 'org-1')
    expect(resolveContactDisplay).toHaveBeenCalledWith(null, 'org-1', 'Proveedor')
    expect(result.document_number).toBe('OC-0001')
    expect(result.document_url).toBe('https://erp.test/compras/ordenes/po-1/print')
    expect(result.contact_name).toBe('Proveedor')
  })

  it('resolves a quote via getQuote, with "Cliente" as the contact fallback', async () => {
    ;(getQuote as Mock).mockResolvedValue({
      quote_number: 'PRE-0001', total: '100.00', contact_id: 'contact-1',
    })
    ;(resolveContactDisplay as Mock).mockResolvedValue({ email: 'cliente@test.com', name: 'Cliente' })

    const result = await resolveDocument('quote', 'q-1', ctx)

    expect(resolveContactDisplay).toHaveBeenCalledWith('contact-1', 'org-1', 'Cliente')
    expect(result.document_number).toBe('PRE-0001')
  })
})
