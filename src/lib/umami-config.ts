/** Shared Umami client configuration (safe to import from client and server). */

export const UMAMI_HOST = process.env.NEXT_PUBLIC_UMAMI_HOST ?? ''
export const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? ''

export function isUmamiConfigured(): boolean {
  return UMAMI_HOST.length > 0 && UMAMI_WEBSITE_ID.length > 0
}

/** Umami is off in local dev unless NEXT_PUBLIC_UMAMI_DEV=true. */
export function isUmamiEnabled(): boolean {
  if (!isUmamiConfigured()) return false
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_UMAMI_DEV !== 'true') {
    return false
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return false
  }
  return true
}

export function umamiScriptUrl(): string {
  const base = UMAMI_HOST.replace(/\/$/, '')
  return `${base}/script.js`
}
