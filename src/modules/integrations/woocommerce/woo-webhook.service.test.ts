import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'node:crypto'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./woocommerce-site.model', () => ({ default: { findByPk: vi.fn() } }))
vi.mock('./woo-sites.service', () => ({ getWebhookSecret: vi.fn() }))
vi.mock('./woo-queue', () => ({ enqueue: vi.fn() }))

import { verifySignature } from './woo-webhook.service'

const secret = 'shhh-secret'
const body = JSON.stringify({ id: 42, status: 'processing' })

describe('verifySignature', () => {
  it('accepts a correct HMAC-SHA256 base64 signature', () => {
    const sig = createHmac('sha256', secret).update(body, 'utf8').digest('base64')
    expect(verifySignature(body, sig, secret)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const sig = createHmac('sha256', secret).update(body, 'utf8').digest('base64')
    expect(verifySignature(body + 'x', sig, secret)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const sig = createHmac('sha256', 'other', ).update(body, 'utf8').digest('base64')
    expect(verifySignature(body, sig, secret)).toBe(false)
  })

  it('rejects a missing signature', () => {
    expect(verifySignature(body, null, secret)).toBe(false)
  })
})
