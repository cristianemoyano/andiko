import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/modules/sales/invoice.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/sales/credit-note.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/sales/debit-note.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/contacts/contact.model', () => ({ default: {} }))
vi.mock('@/modules/sales/sales-branch-associations', () => ({ ensureSalesBranchAssociations: vi.fn() }))

import Invoice from '@/modules/sales/invoice.model'
import CreditNote from '@/modules/sales/credit-note.model'
import DebitNote from '@/modules/sales/debit-note.model'
import { buildLibroIvaVentas } from './libro-iva-ventas.service'

const ctx = { orgId: 'org-1', userId: 'u-1', defaultBranchId: null, allowedBranchIds: [] }

beforeEach(() => vi.clearAllMocks())

describe('buildLibroIvaVentas', () => {
  it('aggregates invoices positively and credit notes negatively', async () => {
    ;(Invoice.findAll as Mock).mockResolvedValue([
      {
        issue_date: new Date(Date.UTC(2026, 5, 10)),
        comprobante_tipo: 1,
        cae: '70000000000001',
        invoice_number: 'FAC-03-0001',
        subtotal: '1000.00',
        discount_amount: '0.00',
        tax_amount: '210.00',
        total: '1210.00',
        contact: { legal_name: 'ACME SA', cuit: '30712345670' },
      },
    ])
    ;(CreditNote.findAll as Mock).mockResolvedValue([
      {
        issue_date: new Date(Date.UTC(2026, 5, 15)),
        comprobante_tipo: 3,
        cae: '70000000000002',
        credit_note_number: 'NC-03-0001',
        subtotal: '100.00',
        discount_amount: '0.00',
        tax_amount: '21.00',
        total: '121.00',
        contact: { legal_name: 'ACME SA', cuit: '30712345670' },
      },
    ])
    ;(DebitNote.findAll as Mock).mockResolvedValue([])

    const result = await buildLibroIvaVentas(ctx, { from: new Date(Date.UTC(2026, 5, 1)), to: new Date(Date.UTC(2026, 5, 30)) })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({ kind: 'invoice', number: 'FAC-03-0001', neto: '1000.00', sign: 1 })
    expect(result.rows[1]).toMatchObject({ kind: 'credit_note', number: 'NC-03-0001', sign: -1 })
    expect(result.totals).toEqual({ neto: '900.00', iva: '189.00', total: '1089.00', count: 2 })
  })

  it('returns zero totals for an empty period', async () => {
    ;(Invoice.findAll as Mock).mockResolvedValue([])
    ;(CreditNote.findAll as Mock).mockResolvedValue([])
    ;(DebitNote.findAll as Mock).mockResolvedValue([])

    const result = await buildLibroIvaVentas(ctx, { from: new Date(Date.UTC(2026, 0, 1)), to: new Date(Date.UTC(2026, 0, 31)) })
    expect(result.totals).toEqual({ neto: '0.00', iva: '0.00', total: '0.00', count: 0 })
  })
})
