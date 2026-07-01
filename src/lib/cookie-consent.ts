/**
 * Feature flag for the self-hosted cookie consent banner.
 *
 * The Platform currently only sets strictly necessary cookies (session), which
 * do not require consent under applicable law. This stays `false` until
 * analytics (non-essential) cookies are introduced — flip it to `true` at
 * that point, and mount `CookieConsentBanner` in the root layout.
 */
export const COOKIE_CONSENT_ENABLED = false

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
