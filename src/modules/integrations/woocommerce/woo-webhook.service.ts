import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import logger from '@/lib/logger'
import WoocommerceSite from './woocommerce-site.model'
import { getWebhookSecret } from './woo-sites.service'
import { enqueue } from './woo-queue'

/**
 * Verifies a WooCommerce webhook signature: base64( HMAC-SHA256(rawBody, secret) )
 * delivered in the `X-WC-Webhook-Signature` header. Constant-time comparison.
 */
export function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export class WebhookAuthError extends Error {
  readonly code = 'WEBHOOK_UNAUTHORIZED' as const
}

/**
 * Authenticates a webhook delivery and enqueues an order-ingest job. Returns fast
 * (the actual REST round-trip happens in the worker) for webhook responsiveness.
 */
export async function handleWebhook(
  siteId: string,
  rawBody: string,
  headers: { signature: string | null; topic: string | null },
): Promise<void> {
  const site = await WoocommerceSite.findByPk(siteId)
  if (!site || !site.is_active) throw new WebhookAuthError('SITE_NOT_FOUND')

  const secret = getWebhookSecret(site)
  if (!secret || !verifySignature(rawBody, headers.signature, secret)) {
    throw new WebhookAuthError('Invalid webhook signature')
  }

  let body: { id?: number } = {}
  try {
    body = JSON.parse(rawBody)
  } catch {
    // WooCommerce ping/handshake deliveries may not be JSON — accept and ignore.
    return
  }
  if (!body.id) return

  await enqueue({
    orgId: site.org_id!,
    siteId: site.id,
    kind: 'order_ingest',
    payload: { woo_order_id: body.id, topic: headers.topic },
  })
  logger.info({ siteId: site.id, wooOrderId: body.id, topic: headers.topic }, 'woocommerce webhook queued')
}
