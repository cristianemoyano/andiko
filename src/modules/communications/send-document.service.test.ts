import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { sendDocumentNotification } = vi.hoisted(() => ({
  sendDocumentNotification: vi.fn(),
}))

vi.mock('@/modules/notifications/document-notification.service', () => ({
  sendDocumentNotification,
}))

import { sendDocumentEmail } from './send-document.service'

const ctx = { orgId: 'org-1', userId: 'user-1', defaultBranchId: null, allowedBranchIds: [] }

describe('sendDocumentEmail', () => {
  beforeEach(() => {
    sendDocumentNotification.mockReset()
  })

  it('delegates to sendDocumentNotification and returns compatible shape', async () => {
    sendDocumentNotification.mockResolvedValue({
      status: 'sent',
      transport: 'log',
      recipient: 'cliente@test.com',
      subject: 'Factura FAC-0001',
      log_id: 'log-1',
      notification_id: 'notif-1',
    })

    const result = await sendDocumentEmail(
      { documentType: 'invoice', documentId: 'doc-1', to: 'cliente@test.com' },
      ctx,
      'user-1',
    )

    expect(sendDocumentNotification).toHaveBeenCalledWith(
      { documentType: 'invoice', documentId: 'doc-1', to: 'cliente@test.com' },
      ctx,
      'user-1',
    )
    expect(result).toEqual({
      status: 'sent',
      transport: 'log',
      recipient: 'cliente@test.com',
      subject: 'Factura FAC-0001',
      log_id: 'log-1',
    })
  })

  it('propagates EMAIL_SEND_FAILED from notifications layer', async () => {
    const err = new Error('EMAIL_SEND_FAILED')
    ;(err as Error & { detail?: string }).detail = 'SMTP rejected'
    sendDocumentNotification.mockRejectedValue(err)

    await expect(
      sendDocumentEmail(
        { documentType: 'invoice', documentId: 'doc-2', to: 'cliente@test.com' },
        ctx,
        'user-1',
      ),
    ).rejects.toThrow('EMAIL_SEND_FAILED')
  })
})
