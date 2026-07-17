import { describe, it, expect } from 'vitest'
import {
  mergeEmailTemplates,
  emailTemplatesUpdateSchema,
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_TOGGLEABLE_KEYS,
  DEFAULT_EMAIL_TEMPLATES,
} from './email-template.schema'

describe('mergeEmailTemplates', () => {
  it('falls back to defaults for all 9 keys when given null', () => {
    const result = mergeEmailTemplates(null)
    for (const key of EMAIL_TEMPLATE_KEYS) {
      expect(result[key]).toEqual(DEFAULT_EMAIL_TEMPLATES[key])
    }
  })

  it('fills in the 5 new keys with defaults when given a legacy 4-key blob', () => {
    const legacyBlob = {
      quote: { subject: 'Custom quote subject', body: 'Custom body' },
      order: { subject: 'S', body: 'B' },
      invoice: { subject: 'S', body: 'B' },
      delivery_note: { subject: 'S', body: 'B' },
    }
    const result = mergeEmailTemplates(legacyBlob)

    expect(result.quote).toEqual(legacyBlob.quote)
    expect(result.purchase_order).toEqual(DEFAULT_EMAIL_TEMPLATES.purchase_order)
    expect(result.payment_receipt).toEqual(DEFAULT_EMAIL_TEMPLATES.payment_receipt)
    expect(result.user_welcome).toEqual(DEFAULT_EMAIL_TEMPLATES.user_welcome)
    expect(result.password_reset).toEqual(DEFAULT_EMAIL_TEMPLATES.password_reset)
    expect(result.low_stock_alert).toEqual(DEFAULT_EMAIL_TEMPLATES.low_stock_alert)
  })

  it('respects a stored enabled:false override on a toggleable key', () => {
    const result = mergeEmailTemplates({
      payment_receipt: { subject: 'S', body: 'B', enabled: false },
    })
    expect(result.payment_receipt.enabled).toBe(false)
  })

  it('ignores unknown/malformed blobs and falls back to defaults', () => {
    const result = mergeEmailTemplates({ quote: { subject: '' } })
    expect(result.quote).toEqual(DEFAULT_EMAIL_TEMPLATES.quote)
  })
})

describe('emailTemplatesUpdateSchema', () => {
  it('accepts a partial patch with any subset of the 9 keys', () => {
    const parsed = emailTemplatesUpdateSchema.safeParse({
      invoice: { subject: 'S', body: 'B' },
      low_stock_alert: { subject: 'S', body: 'B', enabled: false },
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an unknown key (strict mode)', () => {
    const parsed = emailTemplatesUpdateSchema.safeParse({ not_a_real_key: { subject: 'S', body: 'B' } })
    expect(parsed.success).toBe(false)
  })

  it('defaults enabled to true on toggleable keys when omitted', () => {
    const parsed = emailTemplatesUpdateSchema.safeParse({ user_welcome: { subject: 'S', body: 'B' } })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.user_welcome?.enabled).toBe(true)
    }
  })
})

describe('DEFAULT_EMAIL_TEMPLATES', () => {
  it('marks exactly the 3 documented keys as toggleable', () => {
    for (const key of EMAIL_TEMPLATE_TOGGLEABLE_KEYS) {
      expect(DEFAULT_EMAIL_TEMPLATES[key]).toHaveProperty('enabled', true)
    }
    expect(EMAIL_TEMPLATE_TOGGLEABLE_KEYS).toEqual(['payment_receipt', 'user_welcome', 'low_stock_alert'])
  })
})
