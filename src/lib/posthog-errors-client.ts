import posthog from 'posthog-js'

import { isPostHogEnabled } from '@/lib/posthog-config'

/** Reports a client-side React error boundary exception to PostHog. */
export function captureClientException(
  error: Error & { digest?: string },
  context?: Record<string, unknown>,
): void {
  if (!isPostHogEnabled()) return

  posthog.captureException(error, {
    $exception_source: 'client',
    ...context,
    ...(error.digest ? { digest: error.digest } : {}),
  })
}
