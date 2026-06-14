import { describe, expect, it } from 'vitest'
import { emailLogListQuerySchema } from './email-logs.schema'

describe('emailLogListQuerySchema', () => {
  it('applies pagination defaults', () => {
    const parsed = emailLogListQuerySchema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.limit).toBe(20)
  })

  it('accepts search, status and document_type filters', () => {
    const parsed = emailLogListQuerySchema.parse({
      page: '2',
      limit: '50',
      search: 'cliente@dominio.com',
      status: 'failed',
      document_type: 'invoice',
    })
    expect(parsed).toEqual({
      page: 2,
      limit: 50,
      search: 'cliente@dominio.com',
      status: 'failed',
      document_type: 'invoice',
    })
  })

  it('rejects invalid status or document type', () => {
    expect(emailLogListQuerySchema.safeParse({ status: 'pending' }).success).toBe(false)
    expect(emailLogListQuerySchema.safeParse({ document_type: 'receipt' }).success).toBe(false)
  })
})
