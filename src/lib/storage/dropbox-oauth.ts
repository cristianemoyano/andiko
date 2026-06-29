import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '@/config/env'

const DROPBOX_AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize'
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
const DROPBOX_SCOPES = 'files.content.read files.content.write files.metadata.read files.metadata.write'
const STATE_TTL_SECONDS = 10 * 60

export function getDropboxOAuthRedirectUri(): string {
  return `${env.AUTH_URL.replace(/\/$/, '')}/api/v1/sys-admin/storage-settings/dropbox/callback`
}

function sign(data: string): Buffer {
  return createHmac('sha256', env.AUTH_SECRET).update(data).digest()
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

/** Short-lived signed CSRF state for the Dropbox OAuth redirect. */
export function signDropboxOAuthState(): string {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    nonce: randomBytes(16).toString('hex'),
  }
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  return `${body}.${b64url(sign(body))}`
}

export function verifyDropboxOAuthState(state: string): boolean {
  const dot = state.indexOf('.')
  if (dot <= 0) return false
  const body = state.slice(0, dot)
  const sig = state.slice(dot + 1)
  const expected = b64url(sign(body))
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp?: number }
    return typeof payload.exp === 'number' && payload.exp * 1000 >= Date.now()
  } catch {
    return false
  }
}

export function buildDropboxAuthorizeUrl(appKey: string, state: string): string {
  const params = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    token_access_type: 'offline',
    scope: DROPBOX_SCOPES,
    redirect_uri: getDropboxOAuthRedirectUri(),
    state,
  })
  return `${DROPBOX_AUTHORIZE_URL}?${params.toString()}`
}

export async function exchangeDropboxAuthCode(
  appKey: string,
  appSecret: string,
  code: string,
): Promise<{ refreshToken: string }> {
  const res = await fetch(DROPBOX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: appKey,
      client_secret: appSecret,
      redirect_uri: getDropboxOAuthRedirectUri(),
    }),
  })

  const text = await res.text()
  if (!res.ok) {
    let message = `Dropbox OAuth error (${res.status})`
    try {
      const body = JSON.parse(text) as { error?: string; error_description?: string }
      message = body.error_description ?? body.error ?? message
    } catch {
      if (text.trim()) message = text.trim().slice(0, 500)
    }
    throw new Error(message)
  }

  const data = JSON.parse(text) as { refresh_token?: string }
  if (!data.refresh_token) {
    throw new Error('Dropbox no devolvió refresh_token — verificá token_access_type=offline en la app')
  }
  return { refreshToken: data.refresh_token }
}
