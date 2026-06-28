import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('./payment.model', () => ({
  default: {
    findByPk: vi.fn(),
    findOne: vi.fn(),
    findAndCountAll: vi.fn(),
    create: vi.fn(),
    findAll: vi.fn(),
  },
}))
vi.mock('./invoice.model', () => ({
  default: { findByPk: vi.fn(), findOne: vi.fn() },
}))
vi.mock('./invoices.service', () => ({
  recalcInvoiceBalance: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/db', () => ({
  default: { transaction: vi.fn((cb) => cb({})) },
}))
vi.mock('@/modules/auth/user.model', () => ({
  default: class User {},
}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn() } }))
vi.mock('./sales.utils', () => ({
  nextDocumentNumber: vi.fn().mockResolvedValue('COB-0001'),
}))

import Payment from './payment.model'
import Invoice from './invoice.model'
import { createPayment } from './payments.service'

const tenantCtx: TenantContext = {
  orgId: 'org-1',
  userId: 'user-1',
  defaultBranchId: 'branch-1',
  allowedBranchIds: ['branch-1'],
}

const mockInvoice = (status = 'issued') => ({
  id: 'inv-1',
  status,
  branch_id: 'branch-1',
})

beforeEach(() => vi.clearAllMocks())

describe('createPayment', () => {
  const input = {
    invoice_id:     'inv-1',
    amount:         100,
    payment_method: 'transfer' as const,
  }

  it('creates payment for an issued invoice', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(mockInvoice('issued'))
    ;(Payment.create as Mock).mockResolvedValue({ id: 'pay-1', ...input })

    const result = await createPayment(input, tenantCtx, 'actor-1')
    expect(result).toMatchObject({ id: 'pay-1' })
    expect(Payment.create).toHaveBeenCalledOnce()
  })

  it('creates payment for a partially_paid invoice', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(mockInvoice('partially_paid'))
    ;(Payment.create as Mock).mockResolvedValue({ id: 'pay-2', ...input })

    await expect(createPayment(input, tenantCtx, 'actor-1')).resolves.toBeDefined()
  })

  it('throws INVOICE_NOT_FOUND when invoice is missing', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(null)
    await expect(createPayment(input, tenantCtx, 'actor-1')).rejects.toThrow('INVOICE_NOT_FOUND')
  })

  it('throws INVOICE_CANCELLED for cancelled invoices', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(mockInvoice('cancelled'))
    await expect(createPayment(input, tenantCtx, 'actor-1')).rejects.toThrow('INVOICE_CANCELLED')
  })

  it('throws INVOICE_NOT_ISSUED for draft invoices', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(mockInvoice('draft'))
    await expect(createPayment(input, tenantCtx, 'actor-1')).rejects.toThrow('INVOICE_NOT_ISSUED')
  })

  it('throws INVOICE_ALREADY_PAID for fully paid invoices', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(mockInvoice('paid'))
    await expect(createPayment(input, tenantCtx, 'actor-1')).rejects.toThrow('INVOICE_ALREADY_PAID')
  })

  it('throws INVOICE_BRANCH_REQUIRED when invoice has no branch', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue({ ...mockInvoice('issued'), branch_id: null })
    await expect(createPayment(input, tenantCtx, 'actor-1')).rejects.toThrow('INVOICE_BRANCH_REQUIRED')
  })

  it('sets payment branch_id from invoice', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(mockInvoice('issued'))
    ;(Payment.create as Mock).mockResolvedValue({ id: 'pay-1' })

    await createPayment(input, tenantCtx, 'actor-1')

    expect(Payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ branch_id: 'branch-1' }),
      expect.anything(),
    )
  })
})
