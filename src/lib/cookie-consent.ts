/**
 * Feature flag for the self-hosted cookie consent banner.
 *
 * Enabled now that PostHog analytics cookies are in use. PostHog stays
 * opted-out until the user accepts analytics in `CookieConsentBanner`.
 */
export const COOKIE_CONSENT_ENABLED = true

const STORAGE_KEY = 'andiko_cookie_consent'

export type CookieConsentChoice = {
  necessary: true
  analytics: boolean
}

/** Reads the stored consent choice from localStorage. Returns null if absent or invalid. */
export function getStoredCookieConsent(): CookieConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.necessary === true &&
      typeof parsed.analytics === 'boolean'
    ) {
      return parsed as CookieConsentChoice
    }
    return null
  } catch {
    return null
  }
}

/** Persists the user's consent choice to localStorage. */
export function storeCookieConsent(choice: CookieConsentChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice))
  } catch {
    // localStorage may be unavailable (private mode, quota) — ignore silently.
  }
}
