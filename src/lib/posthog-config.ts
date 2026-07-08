/** Shared PostHog client configuration (safe to import from client and server). */

export const POSTHOG_PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN

export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

/** PostHog app UI host (links in replay/error views). */
export function posthogUiHost(ingestHost: string = POSTHOG_HOST): string {
  if (ingestHost.includes('eu.i.posthog.com')) return 'https://eu.posthog.com'
  return 'https://us.posthog.com'
}

/** Static assets CDN host paired with the ingest host region. */
export function posthogAssetsHost(ingestHost: string = POSTHOG_HOST): string {
  if (ingestHost.includes('eu.i.posthog.com')) return 'https://eu-assets.i.posthog.com'
  return 'https://us-assets.i.posthog.com'
}

export function isPostHogConfigured(): boolean {
  return typeof POSTHOG_PROJECT_TOKEN === 'string' && POSTHOG_PROJECT_TOKEN.length > 0
}

/** PostHog is off in local dev unless NEXT_PUBLIC_POSTHOG_DEV=true. */
export function isPostHogEnabled(): boolean {
  if (!isPostHogConfigured()) return false
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_POSTHOG_DEV !== 'true') {
    return false
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return false
  }
  return true
}

/** OpenTelemetry logs ingest endpoint for PostHog. */
export function posthogOtlpLogsUrl(ingestHost: string = POSTHOG_HOST): string {
  return `${ingestHost}/i/v1/logs`
}

export const POSTHOG_SERVICE_NAME = 'andiko'
