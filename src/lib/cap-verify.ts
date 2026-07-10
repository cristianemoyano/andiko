import { isCapRuntimeSupported } from '@/lib/cap-config'
import logger from '@/lib/logger'

type SiteVerifyResponse = {
  success?: boolean
}

export const CAP_SECRET_PLACEHOLDER = 'cap-secret-not-configured'

function capSecretKey(): string {
  return process.env.CAP_SECRET_KEY ?? ''
}

function capVerifyUrl(): string {
  return process.env.CAP_VERIFY_URL ?? 'https://cap.andiko.cloud/siteverify'
}

export function isCapServerConfigured(): boolean {
  if (!isCapRuntimeSupported()) return false
  const key = capSecretKey()
  return key.length > 0 && key !== CAP_SECRET_PLACEHOLDER
}

/** Verifies a Cap token server-side via the siteverify endpoint. */
export async function verifyCapToken(token: string): Promise<boolean> {
  if (!isCapServerConfigured()) return true
  if (!token) return false

  try {
    const response = await fetch(capVerifyUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: capSecretKey(), response: token }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      logger.warn({ status: response.status }, 'cap siteverify request failed')
      return false
    }

    const data = (await response.json()) as SiteVerifyResponse
    return data.success === true
  } catch (error) {
    logger.warn({ err: error }, 'cap siteverify error')
    return false
  }
}
