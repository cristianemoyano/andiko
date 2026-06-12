import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_DOCUMENT_TYPES,
  emailTemplatesUpdateSchema,
  mergeEmailTemplates,
  plainTextToHtml,
  renderEmailTemplate,
  renderTemplateString,
  type EmailTemplateContext,
} from './email-template.schema'

const ctx: EmailTemplateContext = {
  contact_name: 'Juan Pérez',
  document_number: 'FAC-0001',
  document_label: 'Factura',
  total: '$ 12.345,67',
  org_name: 'Mi Empresa',
  document_url: 'https://erp.test/ventas/facturas/abc/print',
}

describe('mergeEmailTemplates', () => {
  it('returns defaults for null / non-object', () => {
    expect(mergeEmailTemplates(null)).toEqual(DEFAULT_EMAIL_TEMPLATES)
    expect(mergeEmailTemplates('nope')).toEqual(DEFAULT_EMAIL_TEMPLATES)
  })

  it('overrides only the provided document type, keeping others default', () => {
    const merged = mergeEmailTemplates({ invoice: { subject: 'Custom', body: 'Hola' } })
    expect(merged.invoice).toEqual({ subject: 'Custom', body: 'Hola' })
    expect(merged.quote).toEqual(DEFAULT_EMAIL_TEMPLATES.quote)
  })

  it('falls back to defaults when a stored entry is invalid', () => {
    const merged = mergeEmailTemplates({ invoice: { subject: '' } })
    expect(merged.invoice).toEqual(DEFAULT_EMAIL_TEMPLATES.invoice)
  })

  it('has a default template for every document type', () => {
    for (const type of EMAIL_DOCUMENT_TYPES) {
      expect(DEFAULT_EMAIL_TEMPLATES[type].subject.length).toBeGreaterThan(0)
      expect(DEFAULT_EMAIL_TEMPLATES[type].body.length).toBeGreaterThan(0)
    }
  })
})

describe('emailTemplatesUpdateSchema', () => {
  it('accepts a partial subset of document types', () => {
    expect(emailTemplatesUpdateSchema.safeParse({ quote: { subject: 'S', body: 'B' } }).success).toBe(true)
    expect(emailTemplatesUpdateSchema.safeParse({}).success).toBe(true)
  })

  it('rejects an unknown document type key', () => {
    expect(emailTemplatesUpdateSchema.safeParse({ bogus: { subject: 'S', body: 'B' } }).success).toBe(false)
  })

  it('rejects an empty subject or body', () => {
    expect(emailTemplatesUpdateSchema.safeParse({ quote: { subject: '', body: 'B' } }).success).toBe(false)
    expect(emailTemplatesUpdateSchema.safeParse({ quote: { subject: 'S', body: '' } }).success).toBe(false)
  })
})

describe('renderTemplateString', () => {
  it('interpolates known variables', () => {
    expect(renderTemplateString('Hola {{contact_name}}, total {{total}}', ctx)).toBe(
      'Hola Juan Pérez, total $ 12.345,67',
    )
  })

  it('tolerates whitespace inside the braces', () => {
    expect(renderTemplateString('{{ document_number }}', ctx)).toBe('FAC-0001')
  })

  it('leaves unknown variables untouched', () => {
    expect(renderTemplateString('Hola {{unknown_var}}', ctx)).toBe('Hola {{unknown_var}}')
  })
})

describe('renderEmailTemplate', () => {
  it('renders both subject and body', () => {
    const out = renderEmailTemplate(DEFAULT_EMAIL_TEMPLATES.invoice, ctx)
    expect(out.subject).toContain('FAC-0001')
    expect(out.subject).toContain('Mi Empresa')
    expect(out.body).toContain('Juan Pérez')
    expect(out.body).toContain('$ 12.345,67')
    // every placeholder should be resolved
    expect(out.body).not.toMatch(/\{\{/)
  })
})

describe('plainTextToHtml', () => {
  it('escapes HTML-significant characters', () => {
    const html = plainTextToHtml('a < b & c > d')
    expect(html).toContain('a &lt; b &amp; c &gt; d')
  })

  it('converts newlines to <br/>', () => {
    expect(plainTextToHtml('line1\nline2')).toContain('line1<br/>line2')
  })

  it('linkifies http(s) URLs', () => {
    const html = plainTextToHtml('ver https://erp.test/doc aquí')
    expect(html).toContain('<a href="https://erp.test/doc">https://erp.test/doc</a>')
  })
})
