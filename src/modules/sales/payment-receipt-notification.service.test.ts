import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/config/env', () => ({ env: { AUTH_URL: 'https://erp.test' } }))
vi.mock('./invoice.model', () => ({
  default: { findOne: vi.fn() },
}))
vi.mock('@/modules/auth/organization.model', () => ({
  default: { findByPk: vi.fn() },
}))
vi.mock('@/modules/contacts/contact-lookup.service', () => ({
  resolveContactDisplay: vi.fn(),
}))
vi.mock('@/modules/communications/email-templates.service', () => ({
  getEffectiveEmailTemplates: vi.fn(),
}))
vi.mock('@/modules/notifications/emit-notification.service', () => ({
  emitNotification: vi.fn().mockResolvedValue({ status: 'sent' }),
}))

import Invoice from './invoice.model'
import Organization from '@/modules/auth/organization.model'
import { resolveContactDisplay } from '@/modules/contacts/contact-lookup.service'
import { getEffectiveEmailTemplates } from '@/modules/communications/email-templates.service'
import { emitNotification } from '@/modules/notifications/emit-notification.service'
import { sendPaymentReceiptEmail } from './payment-receipt-notification.service'

const ctx: TenantContext = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] }

const PAYMENT_ID = '550e8400-e29b-41d4-a716-446655440012'
const INVOICE_ID = '550e8400-e29b-41d4-a716-446655440011'

const payment = {
  id: PAYMENT_ID,
  invoice_id: INVOICE_ID,
  contact_id: 'contact-1',
  payment_number: 'COB-0001',
  amount: '150.00',
  payment_date: new Date('2026-07-12T00:00:00Z'),
} as unknown as import('./payment.model').default

beforeEach(() => {
  vi.clearAllMocks()
  ;(getEffectiveEmailTemplates as Mock).mockResolvedValue({ payment_receipt: { enabled: true } })
  ;(Invoice.findOne as Mock).mockResolvedValue({ id: INVOICE_ID, invoice_number: 'FAC-0001' })
  ;(resolveContactDisplay as Mock).mockResolvedValue({ email: 'cliente@test.com', name: 'Juan' })
  ;(Organization.findByPk as Mock).mockResolvedValue({ name: 'Mi Empresa' })
})

describe('sendPaymentReceiptEmail', () => {
  it('does nothing when the org disabled the payment_receipt template', async () => {
    ;(getEffectiveEmailTemplates as Mock).mockResolvedValue({ payment_receipt: { enabled: false } })

    await sendPaymentReceiptEmail(payment, ctx, 'actor-1')

    expect(Invoice.findOne).not.toHaveBeenCalled()
    expect(emitNotification).not.toHaveBeenCalled()
  })

  it('throws INVOICE_NOT_FOUND when the invoice cannot be resolved', async () => {
    ;(Invoice.findOne as Mock).mockResolvedValue(null)
    await expect(sendPaymentReceiptEmail(payment, ctx, 'actor-1')).rejects.toThrow('INVOICE_NOT_FOUND')
  })

  it('throws NO_RECIPIENT_EMAIL when the contact has no email', async () => {
    ;(resolveContactDisplay as Mock).mockResolvedValue({ email: null, name: 'Juan' })
    await expect(sendPaymentReceiptEmail(payment, ctx, 'actor-1')).rejects.toThrow('NO_RECIPIENT_EMAIL')
  })

  it('emits sales.payment_receipt with the resolved contact/invoice/org data', async () => {
    await sendPaymentReceiptEmail(payment, ctx, 'actor-1')

    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'sales.payment_receipt',
        recipient: { kind: 'email', address: 'cliente@test.com' },
        payload: expect.objectContaining({
          invoice_id: INVOICE_ID,
          invoice_number: 'FAC-0001',
          payment_id: PAYMENT_ID,
          payment_number: 'COB-0001',
          contact_name: 'Juan',
          org_name: 'Mi Empresa',
        }),
      }),
      { orgId: 'org-1', actorId: 'actor-1' },
    )
  })
})
