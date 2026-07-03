import posthog from 'posthog-js'

import type { CookieConsentChoice } from '@/lib/cookie-consent'
import { isPostHogEnabled } from '@/lib/posthog-config'

/** Applies the user's cookie consent choice to PostHog capture. */
export function applyPostHogConsent(choice: CookieConsentChoice): void {
  if (!isPostHogEnabled()) return

  if (choice.analytics) {
    posthog.opt_in_capturing()
  } else {
    posthog.opt_out_capturing()
  }
}
