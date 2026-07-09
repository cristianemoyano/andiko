import 'server-only'

import type { RequestErrorContext } from 'next/dist/server/instrumentation/types'

import { isPostHogEnabled } from '@/lib/posthog-config'
import { getPostHogClient } from '@/lib/posthog-server'

type RequestLike = Readonly<{
  path: string
  method: string
  headers: NodeJS.Dict<string | string[]>
}>

/** Reads PostHog's browser cookie to link server exceptions to the same person. */
export function parsePostHogDistinctId(cookieHeader: string): string | null {
  const match = cookieHeader.match(/ph_phc_.*?_posthog=([^;]+)/)
  if (!match?.[1]) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as { distinct_id?: string }
    return typeof parsed.distinct_id === 'string' ? parsed.distinct_id : null
  } catch {
    return null
  }
}

function cookieHeaderString(headers: RequestLike['headers']): string {
  const cookieHeader = headers.cookie
  return Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader ?? ''
}

/** Reports an unhandled server request error to PostHog Error Tracking. */
export async function captureRequestError(
  error: unknown,
  request: RequestLike,
  context: Readonly<RequestErrorContext>,
): Promise<void> {
  if (!isPostHogEnabled()) return

  const client = getPostHogClient()
  if (!client) return

  const distinctId = parsePostHogDistinctId(cookieHeaderString(request.headers))
    ?? `server:${context.routePath}`

  const digest = error instanceof Error && 'digest' in error
    ? (error as Error & { digest?: string }).digest
    : undefined

  await client.captureExceptionImmediate(error, distinctId, {
    $exception_source: 'server',
    route_path: context.routePath,
    route_type: context.routeType,
    router_kind: context.routerKind,
    http_method: request.method,
    http_path: request.path,
    ...(digest ? { digest } : {}),
  })
}
