import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('@/modules/contacts/contact.model', () => ({
  default: {
    findOne: vi.fn(),
  },
}))

vi.mock('./invoice.model', () => ({
  default: {
    findAll: vi.fn(),
  },
}))

vi.mock('./payment.model', () => ({
  default: {
    findAll: vi.fn(),
  },
}))

import Contact from '@/modules/contacts/contact.model'
import Invoice from './invoice.model'
import Payment from './payment.model'
import { getAccountStatement } from './account-statement.service'

const tenantCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: null,
  allowedBranchIds: [],
}

function mockContact() {
  ;(Contact.findOne as Mock).mockResolvedValue({
    id: 'contact-1',
    legal_name: 'Cliente SRL',
    trade_name: 'Cliente',
  })
}

describe('getAccountStatement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockContact()
  })

  it('builds summary and running balance with partial payments', async () => {
    ;(Invoice.findAll as Mock).mockResolvedValue([
      {
        id: 'inv-1',
        invoice_number: 'FAC-0001',
        status: 'issued',
        issue_date: new Date('2026-01-01T12:00:00.000Z'),
        due_date: new Date('2026-01-06T12:00:00.000Z'),
        created_at: new Date('2026-01-01T10:00:00.000Z'),
        total: '100.00',
        paid_amount: '40.00',
        balance: '60.00',
        currency: 'ARS',
        notes: null,
      },
      {
        id: 'inv-2',
        invoice_number: 'FAC-0002',
        status: 'partially_paid',
        issue_date: new Date('2026-01-10T12:00:00.000Z'),
        due_date: new Date('2999-01-20T12:00:00.000Z'),
        created_at: new Date('2026-01-10T10:00:00.000Z'),
        total: '200.00',
        paid_amount: '140.00',
        balance: '60.00',
        currency: 'ARS',
        notes: 'Venta enero',
      },
    ])
    ;(Payment.findAll as Mock).mockResolvedValue([
      {
        id: 'pay-1',
        invoice_id: 'inv-1',
        payment_number: 'COB-0001',
        payment_date: new Date('2026-01-05T12:00:00.000Z'),
        amount: '40.00',
        reference: null,
        notes: null,
        invoice: { status: 'issued' },
      },
      {
        id: 'pay-2',
        invoice_id: 'inv-2',
        payment_number: 'COB-0002',
        payment_date: new Date('2026-01-12T12:00:00.000Z'),
        amount: '140.00',
        reference: null,
        notes: null,
        invoice: { status: 'partially_paid' },
      },
    ])

    const result = await getAccountStatement('contact-1', { page: 1, limit: 20, summary_only: false }, tenantCtx)

    expect(result.summary).toMatchObject({
      total_invoiced: '300.00',
      total_paid: '180.00',
      balance: '120.00',
      overdue_balance: '60.00',
      current_balance: '60.00',
      debt_status: 'overdue',
    })
    expect(result.data).toHaveLength(4)
    expect(result.data[0]).toMatchObject({ movement_type: 'invoice', running_balance: '100.00' })
    expect(result.data[1]).toMatchObject({ movement_type: 'payment', running_balance: '60.00' })
    expect(result.data[3]).toMatchObject({ movement_type: 'payment', running_balance: '120.00' })
  })

  it('excludes cancelled documents from statement lines', async () => {
    ;(Invoice.findAll as Mock).mockResolvedValue([
      {
        id: 'inv-ok',
        invoice_number: 'FAC-0100',
        status: 'issued',
        issue_date: new Date('2026-02-01T12:00:00.000Z'),
        due_date: null,
        created_at: new Date('2026-02-01T10:00:00.000Z'),
        total: '50.00',
        paid_amount: '0.00',
        balance: '50.00',
        currency: 'ARS',
        notes: null,
      },
      {
        id: 'inv-cancelled',
        invoice_number: 'FAC-0101',
        status: 'cancelled',
        issue_date: new Date('2026-02-02T12:00:00.000Z'),
        due_date: null,
        created_at: new Date('2026-02-02T10:00:00.000Z'),
        total: '100.00',
        paid_amount: '0.00',
        balance: '0.00',
        currency: 'ARS',
        notes: null,
      },
    ])
    ;(Payment.findAll as Mock).mockResolvedValue([
      {
        id: 'pay-valid',
        invoice_id: 'inv-ok',
        payment_number: 'COB-0100',
        payment_date: new Date('2026-02-03T12:00:00.000Z'),
        amount: '20.00',
        reference: null,
        notes: null,
        invoice: { status: 'issued' },
      },
      {
        id: 'pay-cancelled',
        invoice_id: 'inv-cancelled',
        payment_number: 'COB-0101',
        payment_date: new Date('2026-02-04T12:00:00.000Z'),
        amount: '30.00',
        reference: null,
        notes: null,
        invoice: { status: 'cancelled' },
      },
    ])

    const result = await getAccountStatement('contact-1', { page: 1, limit: 20, summary_only: false }, tenantCtx)
    const ids = result.data.map(row => row.id)

    expect(ids).toContain('invoice:inv-ok')
    expect(ids).toContain('payment:pay-valid')
    expect(ids).not.toContain('invoice:inv-cancelled')
    expect(ids).not.toContain('payment:pay-cancelled')
  })

  it('keeps running balance with opening balance when filtering by date', async () => {
    ;(Invoice.findAll as Mock).mockResolvedValue([
      {
        id: 'inv-1',
        invoice_number: 'FAC-0001',
        status: 'issued',
        issue_date: new Date('2026-01-01T12:00:00.000Z'),
        due_date: null,
        created_at: new Date('2026-01-01T10:00:00.000Z'),
        total: '100.00',
        paid_amount: '50.00',
        balance: '50.00',
        currency: 'ARS',
        notes: null,
      },
      {
        id: 'inv-2',
        invoice_number: 'FAC-0002',
        status: 'issued',
        issue_date: new Date('2026-01-10T12:00:00.000Z'),
        due_date: null,
        created_at: new Date('2026-01-10T10:00:00.000Z'),
        total: '200.00',
        paid_amount: '0.00',
        balance: '200.00',
        currency: 'ARS',
        notes: null,
      },
    ])
    ;(Payment.findAll as Mock).mockResolvedValue([
      {
        id: 'pay-1',
        invoice_id: 'inv-1',
        payment_number: 'COB-0001',
        payment_date: new Date('2026-01-05T12:00:00.000Z'),
        amount: '50.00',
        reference: null,
        notes: null,
        invoice: { status: 'issued' },
      },
    ])

    const result = await getAccountStatement(
      'contact-1',
      { page: 1, limit: 20, summary_only: false, from: new Date('2026-01-10T00:00:00.000Z') },
      tenantCtx,
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      id: 'invoice:inv-2',
      running_balance: '250.00',
    })
  })

  it('queries payments by invoice ids to include payments without payment.contact_id', async () => {
    ;(Invoice.findAll as Mock).mockResolvedValue([
      {
        id: 'inv-1',
        invoice_number: 'FAC-9001',
        status: 'issued',
        issue_date: new Date('2026-03-01T12:00:00.000Z'),
        due_date: null,
        created_at: new Date('2026-03-01T10:00:00.000Z'),
        total: '100.00',
        paid_amount: '100.00',
        balance: '0.00',
        currency: 'ARS',
        notes: null,
      },
    ])
    ;(Payment.findAll as Mock).mockResolvedValue([
      {
        id: 'pay-9001',
        invoice_id: 'inv-1',
        payment_number: 'COB-9001',
        payment_date: new Date('2026-03-02T12:00:00.000Z'),
        amount: '100.00',
        reference: null,
        notes: null,
        contact_id: null,
        invoice: { status: 'issued' },
      },
    ])

    const result = await getAccountStatement('contact-1', { page: 1, limit: 20, summary_only: false }, tenantCtx)
    const paymentsCall = (Payment.findAll as Mock).mock.calls[0]?.[0] as { where?: Record<string, unknown> } | undefined

    expect(paymentsCall?.where).toEqual(expect.objectContaining({ invoice_id: expect.any(Object) }))
    expect(result.data.some(row => row.movement_type === 'payment' && row.movement_id === 'pay-9001')).toBe(true)
  })

  it('orders invoice before payment on the same day for running balance readability', async () => {
    ;(Invoice.findAll as Mock).mockResolvedValue([
      {
        id: 'inv-day',
        invoice_number: 'FAC-7777',
        status: 'issued',
        issue_date: new Date('2026-04-22T23:59:59.000Z'),
        due_date: null,
        created_at: new Date('2026-04-22T23:59:59.000Z'),
        total: '406318.00',
        paid_amount: '406318.00',
        balance: '0.00',
        currency: 'ARS',
        notes: null,
      },
    ])
    ;(Payment.findAll as Mock).mockResolvedValue([
      {
        id: 'pay-day',
        invoice_id: 'inv-day',
        payment_number: 'COB-01-0002',
        payment_date: new Date('2026-04-22T00:00:01.000Z'),
        amount: '406318.00',
        reference: null,
        notes: null,
        invoice: { status: 'issued' },
      },
    ])

    const result = await getAccountStatement('contact-1', { page: 1, limit: 20, summary_only: false }, tenantCtx)

    expect(result.data[0]).toMatchObject({
      movement_type: 'invoice',
      running_balance: '406318.00',
    })
    expect(result.data[1]).toMatchObject({
      movement_type: 'payment',
      running_balance: '0.00',
    })
  })
})
