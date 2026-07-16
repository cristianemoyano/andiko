import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Transaction } from 'sequelize'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { getResolvedEmailSettings, getEffectiveEmailTemplates, buildTransport, emailLogCreate } = vi.hoisted(() => ({
  getResolvedEmailSettings: vi.fn(),
  getEffectiveEmailTemplates: vi.fn(),
  buildTransport: vi.fn(),
  emailLogCreate: vi.fn(),
}))

vi.mock('@/modules/communications/email-settings.service', () => ({ getResolvedEmailSettings }))
vi.mock('@/modules/communications/email-templates.service', () => ({ getEffectiveEmailTemplates }))
vi.mock('@/modules/communications/transport', () => ({ buildTransport }))
vi.mock('@/modules/communications/email-log.model', () => ({ default: { create: emailLogCreate } }))

import { EmailChannelAdapter } from './email.channel'
import type Notification from '../notification.model'
import type NotificationDelivery from '../notification-delivery.model'

const ALL_TEMPLATES = {
  quote: { subject: 'Q {{document_number}}', body: 'Hola {{contact_name}}' },
  order: { subject: 'S', body: 'B' },
  invoice: { subject: 'S', body: 'B' },
  delivery_note: { subject: 'S', body: 'B' },
  purchase_order: { subject: 'S', body: 'B' },
  payment_receipt: {
    subject: 'Recibo {{payment_number}}', body: 'Pagaste {{amount}} el {{payment_date}}', enabled: true,
  },
  user_welcome: { subject: 'Bienvenido {{user_name}}', body: 'Entra a {{login_url}}', enabled: true },
  password_reset: { subject: 'Reset', body: 'Andá a {{reset_url}}' },
  low_stock_alert: {
    subject: 'Stock bajo {{product_name}}', body: 'Quedan {{quantity}} de {{minimum_quantity}}', enabled: true,
  },
}

function makeNotification(eventKey: string, payload: Record<string, unknown>): Notification {
  return {
    id: 'notif-1',
    org_id: 'org-1',
    event_key: eventKey,
    actor_id: 'user-1',
    recipient_address: 'dest@test.com',
    payload,
  } as unknown as Notification
}

function makeDelivery(): NotificationDelivery {
  return { id: 'delivery-1' } as unknown as NotificationDelivery
}

beforeEach(() => {
  getResolvedEmailSettings.mockReset()
  getEffectiveEmailTemplates.mockReset()
  buildTransport.mockReset()
  emailLogCreate.mockReset()

  getResolvedEmailSettings.mockResolvedValue(null)
  getEffectiveEmailTemplates.mockResolvedValue(ALL_TEMPLATES)
  const send = vi.fn().mockResolvedValue({ transport: 'log', messageId: null })
  buildTransport.mockReturnValue({ kind: 'log', send })
  emailLogCreate.mockResolvedValue({ id: 'log-1' })
})

describe('EmailChannelAdapter.deliver', () => {
  it('renders sales.document.shared via the document template', async () => {
    const notification = makeNotification('sales.document.shared', {
      document_type: 'quote',
      document_id: '550e8400-e29b-41d4-a716-446655440001',
      document_domain: 'sales',
      document_number: 'PRE-0001',
      document_label: 'Presupuesto',
      total: '$ 100',
      org_name: 'Mi Empresa',
      contact_name: 'Juan',
      document_url: 'https://erp.test/x',
    })
    const adapter = new EmailChannelAdapter()
    const result = await adapter.deliver({ notification, delivery: makeDelivery() })

    expect(result.status).toBe('sent')
    expect(result.subject).toBe('Q PRE-0001')
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ document_domain: 'sales', document_type: 'quote', document_id: '550e8400-e29b-41d4-a716-446655440001' }),
      expect.anything(),
    )
  })

  it('renders sales.payment_receipt with document_domain=sales, document_type=payment', async () => {
    const notification = makeNotification('sales.payment_receipt', {
      invoice_id: '550e8400-e29b-41d4-a716-446655440002',
      invoice_number: 'FAC-0001',
      payment_id: '550e8400-e29b-41d4-a716-446655440003',
      payment_number: 'COB-0001',
      contact_name: 'Juan',
      org_name: 'Mi Empresa',
      amount: '$ 100',
      payment_date: '01/01/2026',
      document_url: 'https://erp.test/x',
    })
    const adapter = new EmailChannelAdapter()
    const result = await adapter.deliver({ notification, delivery: makeDelivery() })

    expect(result.status).toBe('sent')
    expect(result.subject).toBe('Recibo COB-0001')
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        document_domain: 'sales',
        document_type: 'payment',
        document_id: '550e8400-e29b-41d4-a716-446655440003',
      }),
      expect.anything(),
    )
  })

  it('renders auth.user_welcome with document_domain=auth, document_type=user', async () => {
    const notification = makeNotification('auth.user_welcome', {
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      user_name: 'Ana',
      org_name: 'Mi Empresa',
      login_url: 'https://erp.test/login',
    })
    const adapter = new EmailChannelAdapter()
    const result = await adapter.deliver({ notification, delivery: makeDelivery() })

    expect(result.status).toBe('sent')
    expect(result.subject).toBe('Bienvenido Ana')
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ document_domain: 'auth', document_type: 'user', document_id: '550e8400-e29b-41d4-a716-446655440004' }),
      expect.anything(),
    )
  })

  it('renders auth.password_reset', async () => {
    const notification = makeNotification('auth.password_reset', {
      user_id: '550e8400-e29b-41d4-a716-446655440005',
      user_name: 'Ana',
      org_name: 'Mi Empresa',
      reset_url: 'https://erp.test/reset-password?token=abc',
    })
    const adapter = new EmailChannelAdapter()
    const result = await adapter.deliver({ notification, delivery: makeDelivery() })

    expect(result.status).toBe('sent')
    expect(result.body_text).toContain('https://erp.test/reset-password?token=abc')
  })

  it('renders inventory.stock_low with document_domain=inventory, document_type=stock_item', async () => {
    const notification = makeNotification('inventory.stock_low', {
      stock_item_id: '550e8400-e29b-41d4-a716-446655440006',
      product_name: 'Tornillo',
      variant_name: '8mm',
      warehouse_name: 'Depósito Central',
      quantity: '2.00',
      minimum_quantity: '10.00',
      org_name: 'Mi Empresa',
      document_url: 'https://erp.test/inventario/reposicion',
    })
    const adapter = new EmailChannelAdapter()
    const result = await adapter.deliver({ notification, delivery: makeDelivery() })

    expect(result.status).toBe('sent')
    expect(result.subject).toBe('Stock bajo Tornillo')
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ document_domain: 'inventory', document_type: 'stock_item' }),
      expect.anything(),
    )
  })

  it('returns skipped for an unsupported event key without throwing', async () => {
    const notification = makeNotification('not.a.real.event', {})
    const adapter = new EmailChannelAdapter()
    const result = await adapter.deliver({ notification, delivery: makeDelivery() })

    expect(result.status).toBe('skipped')
    expect(emailLogCreate).not.toHaveBeenCalled()
  })

  it('returns failed (not throw) for a malformed payload on a known event', async () => {
    const notification = makeNotification('sales.payment_receipt', { invoice_id: 'not-a-uuid' })
    const adapter = new EmailChannelAdapter()
    const result = await adapter.deliver({ notification, delivery: makeDelivery() })

    expect(result.status).toBe('failed')
    expect(emailLogCreate).not.toHaveBeenCalled()
  })

  it('passes the transaction through to EmailLog.create', async () => {
    const notification = makeNotification('auth.user_welcome', {
      user_id: '550e8400-e29b-41d4-a716-446655440007',
      user_name: 'Ana',
      org_name: 'Mi Empresa',
      login_url: 'https://erp.test/login',
    })
    const fakeTransaction = { id: 'tx-1' } as unknown as Transaction
    const adapter = new EmailChannelAdapter()
    await adapter.deliver({ notification, delivery: makeDelivery(), transaction: fakeTransaction })

    expect(emailLogCreate).toHaveBeenCalledWith(expect.anything(), { transaction: fakeTransaction })
  })
})
