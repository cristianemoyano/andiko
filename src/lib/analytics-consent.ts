import type { CookieConsentChoice } from '@/lib/cookie-consent'
import { applyPostHogConsent } from '@/lib/posthog-consent'

const listeners = new Set<() => void>()

/** Subscribe to analytics consent changes (e.g. Umami script load). */
export function subscribeAnalyticsConsent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Applies cookie consent to all analytics providers (PostHog + Umami). */
export function applyAnalyticsConsent(choice: CookieConsentChoice): void {
  applyPostHogConsent(choice)
  listeners.forEach((listener) => listener())
}
