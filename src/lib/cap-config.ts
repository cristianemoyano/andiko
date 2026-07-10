/** Shared Cap CAPTCHA client configuration (safe to import from client and server). */

export const CAP_SITE_KEY = process.env.NEXT_PUBLIC_CAP_SITE_KEY ?? ''
export const CAP_PUBLIC_HOST = process.env.NEXT_PUBLIC_CAP_HOST ?? ''

export function isCapConfigured(): boolean {
  return CAP_SITE_KEY.length > 0
}

/** Cap widget is off in local dev unless NEXT_PUBLIC_CAP_DEV=true. */
export function isCapEnabled(): boolean {
  if (!isCapConfigured()) return false
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_CAP_DEV !== 'true') {
    return false
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return false
  }
  return true
}

/** Widget API endpoint: https://<instance>/<site-key>/ */
export function capApiEndpoint(): string {
  const host = resolveCapPublicHost().replace(/\/$/, '')
  return `${host}/${CAP_SITE_KEY}/`
}

function resolveCapPublicHost(): string {
  if (CAP_PUBLIC_HOST) return CAP_PUBLIC_HOST
  const verifyUrl = process.env.CAP_VERIFY_URL ?? process.env.NEXT_PUBLIC_CAP_VERIFY_URL ?? ''
  if (verifyUrl) {
    try {
      const url = new URL(verifyUrl)
      return url.origin
    } catch {
      // ignore invalid URL
    }
  }
  return 'https://cap.andiko.cloud'
}
