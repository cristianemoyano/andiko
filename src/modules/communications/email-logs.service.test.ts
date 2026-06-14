import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { findAndCountAll, findOne, findAll } = vi.hoisted(() => ({
  findAndCountAll: vi.fn(),
  findOne: vi.fn(),
  findAll: vi.fn(),
}))

vi.mock('./email-log.model', () => ({
  default: {
    findAndCountAll,
    findOne,
    findAll,
  },
}))

import {
  getEmailLog,
  listDocumentEmailLogs,
  listEmailLogs,
} from './email-logs.service'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    org_id: 'org-1',
    document_domain: 'sales',
    document_type: 'invoice',
    document_id: 'doc-1',
    recipient: 'cliente@test.com',
    subject: 'Mi Empresa — Factura FAC-0001',
    body_text: 'Hola cliente',
    body_html: '<div>Hola cliente</div>',
    transport: 'smtp',
    message_id: '<abc@mail>',
    status: 'sent',
    error: null,
    sent_by: 'user-1',
    created_at: new Date('2026-06-13T12:00:00.000Z'),
    ...overrides,
  }
}

describe('listDocumentEmailLogs', () => {
  beforeEach(() => {
    findAll.mockReset()
  })

  it('returns newest document logs for the org', async () => {
    findAll.mockResolvedValue([makeRow()])
    const logs = await listDocumentEmailLogs('org-1', 'invoice', 'doc-1')
    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { org_id: 'org-1', document_type: 'invoice', document_id: 'doc-1' },
        limit: 50,
      }),
    )
    expect(logs).toEqual([
      {
        id: 'log-1',
        recipient: 'cliente@test.com',
        subject: 'Mi Empresa — Factura FAC-0001',
        status: 'sent',
        error: null,
        sent_at: '2026-06-13T12:00:00.000Z',
      },
    ])
  })
})

describe('listEmailLogs', () => {
  beforeEach(() => {
    findAndCountAll.mockReset()
  })

  it('returns paginated audit rows scoped to allowed document types', async () => {
    findAndCountAll.mockResolvedValue({ rows: [makeRow()], count: 1 })
    const result = await listEmailLogs('org-1', {
      page: 1,
      limit: 20,
      allowedDocumentTypes: ['invoice', 'quote'],
    })
    expect(findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          org_id: 'org-1',
        }),
      }),
    )
    expect(result.total).toBe(1)
    expect(result.data[0]).toMatchObject({
      document_type: 'invoice',
      document_label: 'Factura',
      document_number: 'FAC-0001',
      transport: 'smtp',
    })
  })

  it('returns empty result when caller has no allowed document types', async () => {
    const result = await listEmailLogs('org-1', {
      page: 1,
      limit: 20,
      allowedDocumentTypes: [],
    })
    expect(findAndCountAll).not.toHaveBeenCalled()
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20, pages: 0 })
  })
})

describe('getEmailLog', () => {
  beforeEach(() => {
    findOne.mockReset()
  })

  it('returns full detail including stored body', async () => {
    findOne.mockResolvedValue(makeRow())
    const detail = await getEmailLog('org-1', 'log-1', ['invoice'])
    expect(detail.body_text).toBe('Hola cliente')
    expect(detail.body_html).toContain('Hola cliente')
    expect(detail.message_id).toBe('<abc@mail>')
  })

  it('throws when log is missing or document type is not allowed', async () => {
    findOne.mockResolvedValue(null)
    await expect(getEmailLog('org-1', 'missing', ['invoice'])).rejects.toThrow('EMAIL_LOG_NOT_FOUND')

    findOne.mockResolvedValue(makeRow({ document_type: 'delivery_note' }))
    await expect(getEmailLog('org-1', 'log-1', ['invoice'])).rejects.toThrow('EMAIL_LOG_NOT_FOUND')
  })
})
