import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const {
  resolveDocument,
  getResolvedEmailSettings,
  getEffectiveEmailTemplates,
  buildTransport,
  create,
} = vi.hoisted(() => ({
  resolveDocument: vi.fn(),
  getResolvedEmailSettings: vi.fn(),
  getEffectiveEmailTemplates: vi.fn(),
  buildTransport: vi.fn(),
  create: vi.fn(),
}))

vi.mock('./document-resolver', () => ({ resolveDocument }))
vi.mock('./email-settings.service', () => ({ getResolvedEmailSettings }))
vi.mock('./email-templates.service', () => ({ getEffectiveEmailTemplates }))
vi.mock('./transport', () => ({ buildTransport }))
vi.mock('./email-log.model', () => ({
  default: { create },
}))

import { sendDocumentEmail } from './send-document.service'

const ctx = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] }

describe('sendDocumentEmail', () => {
  beforeEach(() => {
    resolveDocument.mockReset()
    getResolvedEmailSettings.mockReset()
    getEffectiveEmailTemplates.mockReset()
    buildTransport.mockReset()
    create.mockReset()
  })

  it('persists rendered body, html, transport and message id on success', async () => {
    resolveDocument.mockResolvedValue({
      contact_name: 'Juan',
      document_number: 'FAC-0001',
      document_label: 'Factura',
      total: '$ 100,00',
      org_name: 'Mi Empresa',
      document_url: 'https://erp.test/print',
    })
    getResolvedEmailSettings.mockResolvedValue(null)
    getEffectiveEmailTemplates.mockResolvedValue({
      invoice: { subject: 'Factura {{document_number}}', body: 'Hola {{contact_name}}' },
      quote: { subject: 'S', body: 'B' },
      order: { subject: 'S', body: 'B' },
      delivery_note: { subject: 'S', body: 'B' },
    })
    const send = vi.fn().mockResolvedValue({ transport: 'log', messageId: null })
    buildTransport.mockReturnValue({ kind: 'log', send })
    create.mockResolvedValue({ id: 'log-1' })

    await sendDocumentEmail(
      { documentType: 'invoice', documentId: 'doc-1', to: 'cliente@test.com' },
      ctx,
      'user-1',
    )

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        document_type: 'invoice',
        document_id: 'doc-1',
        recipient: 'cliente@test.com',
        subject: 'Factura FAC-0001',
        body_text: 'Hola Juan',
        body_html: expect.stringContaining('Hola Juan'),
        transport: 'log',
        message_id: null,
        status: 'sent',
        error: null,
        sent_by: 'user-1',
      }),
    )
  })

  it('persists body and transport kind when SMTP delivery fails', async () => {
    resolveDocument.mockResolvedValue({
      contact_name: 'Juan',
      document_number: 'FAC-0002',
      document_label: 'Factura',
      total: '$ 100,00',
      org_name: 'Mi Empresa',
      document_url: 'https://erp.test/print',
    })
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
    create.mockResolvedValue({ id: 'log-2' })

    await expect(
      sendDocumentEmail(
        { documentType: 'invoice', documentId: 'doc-2', to: 'cliente@test.com' },
        ctx,
        'user-1',
      ),
    ).rejects.toThrow('EMAIL_SEND_FAILED')

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: 'SMTP rejected',
        body_text: 'Hola Juan',
        transport: 'smtp',
        message_id: null,
      }),
    )
  })
})
