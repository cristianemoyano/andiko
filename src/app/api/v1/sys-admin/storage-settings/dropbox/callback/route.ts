import { NextRequest, NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import logger from '@/lib/logger'
import {
  exchangeDropboxAuthCode,
  verifyDropboxOAuthState,
} from '@/lib/storage/dropbox-oauth'
import {
  getResolvedDropboxOAuthCredentials,
  saveDropboxRefreshTokenFromOAuth,
} from '@/modules/storage/storage-settings.service'

const STORAGE_PAGE = '/sys-admin/storage'

function redirectWith(status: 'success' | 'error', message?: string): NextResponse {
  const params = new URLSearchParams({ dropbox_oauth: status })
  if (message) params.set('dropbox_oauth_msg', message.slice(0, 300))
  return NextResponse.redirect(`${STORAGE_PAGE}?${params}`)
}

/** Dropbox OAuth callback — exchanges code for refresh token and stores it encrypted. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { searchParams } = req.nextUrl
  const error = searchParams.get('error_description') ?? searchParams.get('error')
  if (error) {
    return redirectWith('error', error)
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state || !verifyDropboxOAuthState(state)) {
    return redirectWith('error', 'Estado OAuth inválido o expirado. Intentá conectar de nuevo.')
  }

  const creds = await getResolvedDropboxOAuthCredentials()
  if (!creds) {
    return redirectWith('error', 'Faltan App key o App secret en la configuración.')
  }

  try {
    const { refreshToken } = await exchangeDropboxAuthCode(creds.appKey, creds.appSecret, code)
    await saveDropboxRefreshTokenFromOAuth(refreshToken)
    logger.info('Dropbox OAuth refresh token stored')
    return redirectWith('success')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al conectar Dropbox'
    logger.warn({ err }, 'Dropbox OAuth callback failed')
    return redirectWith('error', message)
  }
}
