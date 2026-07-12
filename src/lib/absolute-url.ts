import { env } from '@/config/env'

/** Builds an absolute URL against the app's public base URL (`AUTH_URL`). */
export function absoluteUrl(path: string): string {
  const base = env.AUTH_URL.replace(/\/$/, '')
  return `${base}${path}`
}
