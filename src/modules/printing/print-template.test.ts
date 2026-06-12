import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRINT_TEMPLATE,
  FONT_FAMILY_CSS,
  mergePrintTemplate,
  printTemplateSchema,
  printTemplateUpdateSchema,
} from './print-template.schema'

describe('printTemplateSchema', () => {
  it('accepts a valid full template', () => {
    const r = printTemplateSchema.safeParse(DEFAULT_PRINT_TEMPLATE)
    expect(r.success).toBe(true)
  })

  it('rejects an invalid hex accent color', () => {
    const r = printTemplateSchema.safeParse({ ...DEFAULT_PRINT_TEMPLATE, accent_color: 'red' })
    expect(r.success).toBe(false)
  })

  it('accepts #rgb and #rrggbb', () => {
    expect(printTemplateUpdateSchema.safeParse({ accent_color: '#fff' }).success).toBe(true)
    expect(printTemplateUpdateSchema.safeParse({ accent_color: '#ff8800' }).success).toBe(true)
  })

  it('rejects a non-http, non-data logo url', () => {
    const r = printTemplateUpdateSchema.safeParse({ logo_url: 'ftp://example.com/logo.png' })
    expect(r.success).toBe(false)
  })

  it('accepts an http(s) logo url and a data-URL image', () => {
    expect(printTemplateUpdateSchema.safeParse({ logo_url: 'https://x.test/logo.png' }).success).toBe(true)
    expect(
      printTemplateUpdateSchema.safeParse({ logo_url: 'data:image/png;base64,iVBORw0KGgo=' }).success,
    ).toBe(true)
  })

  it('allows null logo url', () => {
    expect(printTemplateUpdateSchema.safeParse({ logo_url: null }).success).toBe(true)
  })

  it('rejects an unknown font family', () => {
    expect(printTemplateUpdateSchema.safeParse({ font_family: 'comic-sans' }).success).toBe(false)
  })

  it('rejects footer text over 500 chars', () => {
    expect(printTemplateUpdateSchema.safeParse({ footer_text: 'x'.repeat(501) }).success).toBe(false)
  })

  it('rejects an unknown section key', () => {
    expect(printTemplateUpdateSchema.safeParse({ sections: { bogus: true } }).success).toBe(false)
  })
})

describe('mergePrintTemplate', () => {
  it('returns defaults for null / non-object', () => {
    expect(mergePrintTemplate(null)).toEqual(DEFAULT_PRINT_TEMPLATE)
    expect(mergePrintTemplate('nope')).toEqual(DEFAULT_PRINT_TEMPLATE)
  })

  it('returns defaults when stored blob is invalid', () => {
    expect(mergePrintTemplate({ accent_color: 'not-a-color' })).toEqual(DEFAULT_PRINT_TEMPLATE)
  })

  it('overrides only provided fields and keeps default sections', () => {
    const merged = mergePrintTemplate({ accent_color: '#ff0000', sections: { notes: false } })
    expect(merged.accent_color).toBe('#ff0000')
    // un-specified fields keep defaults
    expect(merged.font_family).toBe(DEFAULT_PRINT_TEMPLATE.font_family)
    // sections merged key-by-key
    expect(merged.sections.notes).toBe(false)
    expect(merged.sections.logo).toBe(DEFAULT_PRINT_TEMPLATE.sections.logo)
  })

  it('preserves a fully specified stored template', () => {
    const stored = {
      ...DEFAULT_PRINT_TEMPLATE,
      logo_url: 'https://x.test/l.png',
      accent_color: '#123456',
      font_family: 'serif' as const,
      footer_text: 'Pie',
    }
    expect(mergePrintTemplate(stored)).toMatchObject({
      logo_url: 'https://x.test/l.png',
      accent_color: '#123456',
      font_family: 'serif',
      footer_text: 'Pie',
    })
  })
})

describe('FONT_FAMILY_CSS', () => {
  it('has a stack for every whitelisted font', () => {
    expect(FONT_FAMILY_CSS.sans).toContain('sans-serif')
    expect(FONT_FAMILY_CSS.serif).toContain('serif')
    expect(FONT_FAMILY_CSS.mono).toContain('mono')
  })
})
