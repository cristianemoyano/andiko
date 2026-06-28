import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { WooClient, parseWooGmtDateTime, parseWooOrderCreatedAt } = await import('./woo-client')

describe('parseWooGmtDateTime', () => {
  it('treats Woo *_gmt values without suffix as UTC', () => {
    const parsed = parseWooGmtDateTime('2026-06-28T18:29:00')
    expect(parsed?.toISOString()).toBe('2026-06-28T18:29:00.000Z')
  })

  it('accepts explicit Z suffix', () => {
    const parsed = parseWooGmtDateTime('2026-06-28T18:29:00Z')
    expect(parsed?.toISOString()).toBe('2026-06-28T18:29:00.000Z')
  })

  it('returns null for empty input', () => {
    expect(parseWooGmtDateTime(null)).toBeNull()
    expect(parseWooGmtDateTime('')).toBeNull()
  })
})

describe('parseWooOrderCreatedAt', () => {
  it('reads date_created_gmt only', () => {
    const parsed = parseWooOrderCreatedAt({ date_created_gmt: '2026-06-28T18:29:00' })
    expect(parsed?.toISOString()).toBe('2026-06-28T18:29:00.000Z')
  })
})

describe('WooClient auth mode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
      text: async () => '',
      headers: new Headers({ 'x-wp-totalpages': '1' }),
    }))
  })

  it('uses OAuth 1.0a query params on HTTP store URLs', async () => {
    const client = new WooClient({
      storeUrl: 'http://localhost:8080',
      consumerKey: 'ck_test',
      consumerSecret: 'cs_test',
    })
    await client.listProducts()
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('oauth_consumer_key=ck_test')
    expect(url).toContain('oauth_signature=')
    expect(url).not.toContain('consumer_secret=')
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('uses Basic auth on HTTPS store URLs', async () => {
    const client = new WooClient({
      storeUrl: 'https://shop.example.com',
      consumerKey: 'ck_test',
      consumerSecret: 'cs_test',
    })
    await client.listProducts()
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).not.toContain('oauth_consumer_key=')
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Basic ' + Buffer.from('ck_test:cs_test').toString('base64'))
  })
})
