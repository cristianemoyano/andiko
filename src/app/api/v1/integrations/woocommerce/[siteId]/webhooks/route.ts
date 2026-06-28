import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook, WebhookAuthError } from '@/modules/integrations/woocommerce/woo-webhook.service'

// Public, unauthenticated endpoint: WooCommerce posts here on order events.
// Authenticity is established by HMAC signature verification, not a session.
export async function POST(req: NextRequest, ctx: { params: Promise<{ siteId: string }> }): Promise<NextResponse> {
  const { siteId } = await ctx.params
  const rawBody = await req.text()
  try {
    await handleWebhook(siteId, rawBody, {
      signature: req.headers.get('x-wc-webhook-signature'),
      topic: req.headers.get('x-wc-webhook-topic'),
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof WebhookAuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 401 })
    }
    throw err
  }
}
