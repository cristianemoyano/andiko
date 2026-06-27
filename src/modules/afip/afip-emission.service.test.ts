import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn((cb) => cb({})) } }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/tenancy', () => ({
  whereAllowedBranches: (_ctx: unknown, where: Record<string, unknown> = {}) => ({ ...where }),
}))
vi.mock('@/modules/sales/invoice.model', () => ({ default: { findOne: vi.fn(), findByPk: vi.fn() } }))
vi.mock('@/modules/sales/invoice-item.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/sales/credit-note.model', () => ({ default: { findOne: vi.fn() } }))
vi.mock('@/modules/sales/debit-note.model', () => ({ default: { findOne: vi.fn() } }))
vi.mock('@/modules/auth/branch.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('@/modules/auth/organization.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('@/modules/contacts/contact.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('./afip-emission.model', () => ({ default: { create: vi.fn(), findAll: vi.fn() } }))
vi.mock('./afip-client.factory', () => ({ getAfipClients: vi.fn() }))
vi.mock('./afip-sequence.service', () => ({ resolveNextCbteNumero: vi.fn(async () => 6) }))
vi.mock('@/modules/sales/sales-order.model', () => ({ default: { findOne: vi.fn() } }))

import Invoice from '@/modules/sales/invoice.model'
import InvoiceItem from '@/modules/sales/invoice-item.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import Branch from '@/modules/auth/branch.model'
import Organization from '@/modules/auth/organization.model'
import Contact from '@/modules/contacts/contact.model'
import AfipEmission from './afip-emission.model'
import { requestCAEForInvoice } from './afip-emission.service'
import { StubWsfeClient, type WsfeClient } from './wsfe.client'
import { FE_RESULT } from './afip-codes'

const ctx = { orgId: 'org-1', userId: 'user-1', defaultBranchId: 'b-1', allowedBranchIds: [] }

const mockInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  org_id: 'org-1',
  order_id: null,
  status: 'issued',
  contact_id: 'c-1',
  branch_id: 'b-1',
  issue_date: new Date(Date.UTC(2026, 5, 20)),
  afip_status: 'not_sent',
  update: vi.fn().mockResolvedValue(undefined),
  reload: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

function wireHappyLoads(invoice: ReturnType<typeof mockInvoice>) {
  ;(Invoice.findOne as Mock).mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
    const where = opts.where ?? {}
    if (where.id === invoice.id) return invoice
    if (where.order_id) return null
    return null
  })
  ;(SalesOrder.findOne as Mock).mockResolvedValue(null)
  ;(InvoiceItem.findAll as Mock).mockResolvedValue([
    { iva_rate: '21', tax_base: '1000.00', tax_amount: '210.00' },
  ])
  ;(Organization.findByPk as Mock).mockResolvedValue({ iva_condition: 'responsable_inscripto', cuit: '30111111118' })
  ;(Contact.findByPk as Mock).mockResolvedValue({ iva_condition: 'responsable_inscripto', cuit: '30712345670' })
  ;(Branch.findByPk as Mock).mockResolvedValue({ punto_venta: 3 })
  ;(AfipEmission.create as Mock).mockResolvedValue({ retries: 0, update: vi.fn().mockResolvedValue(undefined) })
}

beforeEach(() => vi.clearAllMocks())

describe('requestCAEForInvoice', () => {
  it('persists CAE and authorized status on approval', async () => {
    const invoice = mockInvoice()
    wireHappyLoads(invoice)

    await requestCAEForInvoice('inv-1', ctx, { wsfe: new StubWsfeClient() })

    expect(invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ afip_status: 'authorized', comprobante_tipo: 1, punto_venta: 3, cbte_numero: 6 }),
      expect.anything(),
    )
    const update = invoice.update.mock.calls[0][0] as { cae: string; cae_expiration: string }
    expect(update.cae).toMatch(/^\d{14}$/)
    expect(update.cae_expiration).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('marks rejected when AFIP does not approve', async () => {
    const invoice = mockInvoice()
    wireHappyLoads(invoice)
    const rejecting: WsfeClient = {
      consultarUltimoAutorizado: async () => 0,
      solicitarCAE: async () => ({ resultado: FE_RESULT.RECHAZADO, cae: null, caeVto: null, cbteNumero: 1, observations: [{ code: 10, msg: 'bad' }] }),
      generateQR: () => 'x',
    }

    await requestCAEForInvoice('inv-1', ctx, { wsfe: rejecting })

    expect(invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ afip_status: 'rejected', afip_observations: [{ code: 10, msg: 'bad' }] }),
      expect.anything(),
    )
  })

  it('queues for contingency on transport error', async () => {
    const invoice = mockInvoice()
    wireHappyLoads(invoice)
    const emission = { retries: 0, update: vi.fn().mockResolvedValue(undefined) }
    ;(AfipEmission.create as Mock).mockResolvedValue(emission)
    const failing: WsfeClient = {
      consultarUltimoAutorizado: async () => 0,
      solicitarCAE: async () => { throw new Error('ECONNRESET') },
      generateQR: () => 'x',
    }

    await requestCAEForInvoice('inv-1', ctx, { wsfe: failing })

    expect(invoice.update).toHaveBeenCalledWith(expect.objectContaining({ afip_status: 'contingency' }))
    expect(emission.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', retries: 1 }))
  })

  it('is idempotent: throws when already authorized', async () => {
    const invoice = mockInvoice({ afip_status: 'authorized' })
    ;(Invoice.findOne as Mock).mockImplementation(async () => invoice)
    ;(InvoiceItem.findAll as Mock).mockResolvedValue([])
    await expect(requestCAEForInvoice('inv-1', ctx, { wsfe: new StubWsfeClient() })).rejects.toThrow('AFIP_ALREADY_AUTHORIZED')
  })

  it('throws when the branch has no punto de venta', async () => {
    const invoice = mockInvoice()
    wireHappyLoads(invoice)
    ;(Branch.findByPk as Mock).mockResolvedValue({ punto_venta: null })
    await expect(requestCAEForInvoice('inv-1', ctx, { wsfe: new StubWsfeClient() })).rejects.toThrow('AFIP_PUNTO_VENTA_REQUIRED')
  })

  it('throws when the document is not issued', async () => {
    const invoice = mockInvoice({ status: 'draft' })
    ;(Invoice.findOne as Mock).mockImplementation(async () => invoice)
    ;(InvoiceItem.findAll as Mock).mockResolvedValue([])
    await expect(requestCAEForInvoice('inv-1', ctx, { wsfe: new StubWsfeClient() })).rejects.toThrow('AFIP_DOCUMENT_NOT_ISSUED')
  })

  it('throws DOCUMENT_NOT_FOUND when missing', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(null)
    await expect(requestCAEForInvoice('bad', ctx, { wsfe: new StubWsfeClient() })).rejects.toThrow('DOCUMENT_NOT_FOUND')
  })

  it('requests a new CAE from AFIP when sibling invoice already has one', async () => {
    const invoice = mockInvoice({ order_id: 'ord-1' })
    const sibling = {
      id: 'inv-sib',
      invoice_number: 'FAC-02-0003',
      cae: '12345678901234',
    }
    wireHappyLoads(invoice)
    ;(Invoice.findOne as Mock).mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
      const where = opts.where ?? {}
      if (where.id === invoice.id) return invoice
      if (where.order_id) return sibling
      return null
    })

    await requestCAEForInvoice('inv-1', ctx, { wsfe: new StubWsfeClient() })

    expect(invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ afip_status: 'authorized', comprobante_tipo: 1, cbte_numero: 6 }),
      expect.anything(),
    )
    expect(AfipEmission.create).toHaveBeenCalled()
  })

  it('syncs CAE from POS order when no invoice on the order has one yet', async () => {
    const invoice = mockInvoice({ order_id: 'ord-pos' })
    ;(Invoice.findOne as Mock).mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
      const where = opts.where ?? {}
      if (where.id === invoice.id) return invoice
      if (where.order_id) return null
      return null
    })
    ;(SalesOrder.findOne as Mock).mockResolvedValue({
      id: 'ord-pos',
      order_number: 'PED-02-0011',
      cae: '99998888777766',
      cae_expiration: '2026-07-15',
      comprobante_tipo: 1,
      punto_venta: 2,
      cbte_numero: 2,
      afip_status: 'authorized',
      afip_observations: null,
    })
    ;(InvoiceItem.findAll as Mock).mockResolvedValue([])
    ;(AfipEmission.findAll as Mock).mockResolvedValue([])

    await requestCAEForInvoice('inv-1', ctx, { wsfe: new StubWsfeClient() })

    expect(invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ afip_status: 'authorized', cae: '99998888777766', cbte_numero: 2 }),
      expect.anything(),
    )
    expect(AfipEmission.create).not.toHaveBeenCalled()
  })
})
