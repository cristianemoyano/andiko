import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const {
  resolveDocument,
  getResolvedEmailSettings,
  getEffectiveEmailTemplates,
  buildTransport,
  notificationCreate,
  deliveryCreate,
  deliveryUpdate,
  emailLogCreate,
} = vi.hoisted(() => ({
  resolveDocument: vi.fn(),
  getResolvedEmailSettings: vi.fn(),
  getEffectiveEmailTemplates: vi.fn(),
  buildTransport: vi.fn(),
  notificationCreate: vi.fn(),
  deliveryCreate: vi.fn(),
  deliveryUpdate: vi.fn(),
  emailLogCreate: vi.fn(),
}))

vi.mock('@/modules/communications/document-resolver', () => ({ resolveDocument }))
vi.mock('@/modules/communications/email-settings.service', () => ({ getResolvedEmailSettings }))
vi.mock('@/modules/communications/email-templates.service', () => ({ getEffectiveEmailTemplates }))
vi.mock('@/modules/communications/transport', () => ({ buildTransport }))
vi.mock('./notification.model', () => ({
  default: { create: notificationCreate },
}))
vi.mock('./notification-delivery.model', () => ({
  default: {
    create: deliveryCreate,
    update: deliveryUpdate,
  },
}))
vi.mock('@/modules/communications/email-log.model', () => ({
  default: { create: emailLogCreate },
}))

import { sendDocumentNotification } from './document-notification.service'

const ctx = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] }

describe('sendDocumentNotification', () => {
  beforeEach(() => {
    resolveDocument.mockReset()
    getResolvedEmailSettings.mockReset()
    getEffectiveEmailTemplates.mockReset()
    buildTransport.mockReset()
    notificationCreate.mockReset()
    deliveryCreate.mockReset()
    deliveryUpdate.mockReset()
    emailLogCreate.mockReset()
  })

  function mockDeliveryRow(id: string) {
    const row = { id, update: deliveryUpdate }
    deliveryUpdate.mockResolvedValue(row)
    return row
  }

  it('emits sales.document.shared and persists email delivery + email_log', async () => {
    resolveDocument.mockResolvedValue({
      contact_name: 'Juan',
      document_number: 'FAC-0001',
      document_label: 'Factura',
      total: '$ 100,00',
      org_name: 'Mi Empresa',
      document_url: 'https://erp.test/ventas/facturas/550e8400-e29b-41d4-a716-446655440001/print',
    })
    notificationCreate.mockImplementation(async (data: { payload: Record<string, unknown> }) => ({
      id: 'notif-1',
      org_id: 'org-1',
      event_key: 'sales.document.shared',
      actor_id: 'user-1',
      recipient_address: 'cliente@test.com',
      payload: data.payload,
    }))
    mockDeliveryRow('delivery-1')
    deliveryCreate.mockResolvedValue(mockDeliveryRow('delivery-1'))
    getResolvedEmailSettings.mockResolvedValue(null)
    getEffectiveEmailTemplates.mockResolvedValue({
      invoice: { subject: 'Factura {{document_number}}', body: 'Hola {{contact_name}}' },
      quote: { subject: 'S', body: 'B' },
      order: { subject: 'S', body: 'B' },
      delivery_note: { subject: 'S', body: 'B' },
    })
    const send = vi.fn().mockResolvedValue({ transport: 'log', messageId: null })
    buildTransport.mockReturnValue({ kind: 'log', send })
    emailLogCreate.mockResolvedValue({ id: 'log-1' })

    const result = await sendDocumentNotification(
      { documentType: 'invoice', documentId: '550e8400-e29b-41d4-a716-446655440001', to: 'cliente@test.com' },
      ctx,
      'user-1',
    )

    expect(notificationCreate).toHaveBeenCalled()
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        document_type: 'invoice',
        document_id: '550e8400-e29b-41d4-a716-446655440001',
        recipient: 'cliente@test.com',
        subject: 'Factura FAC-0001',
        body_text: 'Hola Juan',
        status: 'sent',
        notification_delivery_id: 'delivery-1',
      }),
      expect.any(Object),
    )
    expect(result).toMatchObject({
      status: 'sent',
      transport: 'log',
      recipient: 'cliente@test.com',
      log_id: 'log-1',
      notification_id: 'notif-1',
    })
  })

  it('throws EMAIL_SEND_FAILED when SMTP delivery fails', async () => {
    resolveDocument.mockResolvedValue({
      contact_name: 'Juan',
      document_number: 'FAC-0002',
      document_label: 'Factura',
      total: '$ 100,00',
      org_name: 'Mi Empresa',
      document_url: 'https://erp.test/ventas/facturas/550e8400-e29b-41d4-a716-446655440002/print',
    })
    notificationCreate.mockImplementation(async (data: { payload: Record<string, unknown> }) => ({
      id: 'notif-2',
      org_id: 'org-1',
      event_key: 'sales.document.shared',
      actor_id: 'user-1',
      recipient_address: 'cliente@test.com',
      payload: data.payload,
    }))
    mockDeliveryRow('delivery-2')
    deliveryCreate.mockResolvedValue(mockDeliveryRow('delivery-2'))
    getResolvedEmailSettings.mockResolvedValue({
      enabled: true,
      host: 'smtp.test',
      port: 587,
      secure: false,
      user: 'u@test.com',
      password: 'secret',
      from_name: 'Andiko',
      from_address: 'no-reply@andiko.app',
    })
    getEffectiveEmailTemplates.mockResolvedValue({
      invoice: { subject: 'Factura {{document_number}}', body: 'Hola {{contact_name}}' },
      quote: { subject: 'S', body: 'B' },
      order: { subject: 'S', body: 'B' },
      delivery_note: { subject: 'S', body: 'B' },
    })
    const send = vi.fn().mockRejectedValue(new Error('SMTP rejected'))
    buildTransport.mockReturnValue({ kind: 'smtp', send })
    emailLogCreate.mockResolvedValue({ id: 'log-2' })

    await expect(
      sendDocumentNotification(
        { documentType: 'invoice', documentId: '550e8400-e29b-41d4-a716-446655440002', to: 'cliente@test.com' },
        ctx,
        'user-1',
      ),
    ).rejects.toThrow('EMAIL_SEND_FAILED')

    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: 'SMTP rejected',
        transport: 'smtp',
      }),
      expect.any(Object),
    )
  })
})
