import 'server-only'
import { z } from 'zod'
import { registerAutomationAction } from '../action-registry'
import { assertPublicHttpTarget } from '../ssrf-guard'

const WEBHOOK_TIMEOUT_MS = 15_000
const RESPONSE_SNIPPET_MAX_LENGTH = 2000

const payloadSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST']).default('POST'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
})

registerAutomationAction({
  type: 'core.webhook_call',
  label: 'Llamar a un webhook',
  payloadSchema,
  async run(ctx, payload) {
    await assertPublicHttpTarget(payload.url)
    const response = await fetch(payload.url, {
      method: payload.method,
      headers: { 'content-type': 'application/json', ...payload.headers },
      body: payload.method === 'POST' && payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
      // Whichever fires first: this action's own shorter timeout, or the runner's
      // overall action timeout (ctx.signal) — so a slow/hung request is genuinely
      // aborted instead of continuing after the run is recorded as failed.
      signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)]),
    })
    const bodySnippet = (await response.text()).slice(0, RESPONSE_SNIPPET_MAX_LENGTH)

    if (!response.ok) {
      throw new Error(`Webhook respondió ${response.status}: ${bodySnippet}`)
    }

    return {
      summary: `Webhook respondió ${response.status}`,
      data: { status: response.status, body: bodySnippet },
    }
  },
})
